import { Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { TeamMembership, TeamMembership_teamRole, User } from "@prisma/client";
import { Role } from "src/enums/role.enum";
import { PrismaService } from "src/prisma/prisma.service";
import { getActiveTeamMembership, isTeamLead, getCollectorLoansWithHighActDays } from "./loan.helper";

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    account_id: string;
    role_name: string;
    team_membership: TeamMembership[];
  };
}

@Injectable({ scope: Scope.REQUEST })
export class PermissionsHelper {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private request: AuthenticatedRequest
  ) { }

  get loan() {
    const user = this.request.user;
    return this.getScopedModel('loan', user);
  }

  get committee() {
    const user = this.request.user;
    return this.getScopedModel('committee', user);
  }

  get futurePayment() {
    const user = this.request.user;
    return this.getScopedModel('paymentCommitment', user);
  }

  private getScopedModel(model: string, user: AuthenticatedRequest['user']) {
    return {
      findMany: async (args: any) => {
        const scopedWhere = await this.buildScopedWhere(model, user, args);

        // Remove custom properties that Prisma doesn't recognize
        const { _skipUserScope, ...cleanArgs } = args || {};

        return this.prisma[model].findMany({
          ...cleanArgs,
          where: scopedWhere
        });
      },

      findFirst: async (args: any) => {
        const scopedWhere = await this.buildScopedWhere(model, user, args);

        // Remove custom properties that Prisma doesn't recognize
        const { _skipUserScope, ...cleanArgs } = args || {};

        return this.prisma[model].findFirst({
          ...cleanArgs,
          where: scopedWhere
        });
      },

      count: async (args: any) => {
        const scopedWhere = await this.buildScopedWhere(model, user, args);

        // Remove custom properties that Prisma doesn't recognize
        const { _skipUserScope, ...cleanArgs } = args || {};

        return this.prisma[model].count({
          ...cleanArgs,
          where: scopedWhere
        });
      }
    };
  }

  private addUserScope(where: any, user: AuthenticatedRequest['user'], model: string) {
    if (user.role_name === Role.SUPER_ADMIN || user.role_name === Role.ADMIN || user.role_name === Role.SUPER_LAWYER) {
      return where;
    }

    const scopeCondition = this.buildScopeCondition(user, model);
    return scopeCondition ? this.mergeWhereWithCondition(where, scopeCondition) : where;
  }

  private buildScopeCondition(user: AuthenticatedRequest['user'], model: string) {
    const activeTeamMembership = getActiveTeamMembership(user);
    const teamLead = isTeamLead(user);
    const teamId = activeTeamMembership?.teamId;

    const baseLoanCondition = this.buildLoanAssignmentCondition(user, teamLead, teamId);

    switch (model) {
      case 'loan':
        return baseLoanCondition;

      case 'committee':
      case 'paymentCommitment':
        return { Loan: baseLoanCondition };

      // Easy to add new models here:
      // case 'transaction':
      //   return { Loan: baseLoanCondition };

      // case 'customer':
      //   return this.buildCustomerCondition(user);

      // case 'report':
      //   return { 
      //     OR: [
      //       { createdBy: user.id },
      //       { assignedTo: user.id }
      //     ]
      //   };

      default:
        return null; // No scope restriction for unknown models
    }
  }

  private mergeWhereWithCondition(where: any, newCond: any): any {
    // If where is empty, return newCond directly (keeps shape simple).
    if (!where || Object.keys(where).length === 0) return newCond;

    // If `where` already has AND, append newCond.
    if (Array.isArray(where.AND)) {
      return { ...where, AND: [...where.AND, newCond] };
    }

    // Otherwise create an AND combining the original where and newCond.
    return { AND: [where, newCond] };
  }

  private buildLoanAssignmentCondition(
    user: AuthenticatedRequest['user'],
    teamLead: boolean,
    teamId: number | undefined
  ) {
    // Team leads now see only their own loans by default
    // They can see team member loans only when explicitly filtering by assigneduser
    // This change ensures default view shows only own loans for everyone
    return {
      LoanAssignment: {
        some: {
          isActive: true,
          User: { id: user.id },
        },
      },
    };
  }

  private isSearchMode(args: any): boolean {
    const where = args?.where;

    if (!where) return false;

    // OR block indicates search (based on your system)
    if (Array.isArray(where.AND)) {
      for (const condition of where.AND) {
        if (Array.isArray(condition.OR) && condition.OR.length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  private hasLoanAssignmentFilter(where: any): boolean {
    if (!where) return false;

    // Check if LoanAssignment filter already exists in where clause
    // This happens when user explicitly filters by assigneduser/assignedlawyer
    if (where.LoanAssignment) {
      return true;
    }

    // Check in AND conditions
    if (Array.isArray(where.AND)) {
      for (const condition of where.AND) {
        if (condition.LoanAssignment) {
          return true;
        }
      }
    }

    return false;
  }

  private async buildScopedWhere(
    model: string,
    user: AuthenticatedRequest["user"],
    args: any
  ) {
    let scopedWhere = args?.where || {};
    const searchMode = this.isSearchMode(args);
    const skipUserScopeFlag = args?._skipUserScope === true;

    // Skip user scoping only in these cases:
    // 1. Search mode (user is searching, should see all loans)
    // 2. Explicit skipUserScope flag (set by service layer for team leads with same-role filters)
    const shouldSkipUserScope = searchMode || skipUserScopeFlag;

    if (!shouldSkipUserScope) {
      scopedWhere = this.addUserScope(scopedWhere, user, model);
    }

    // Special collector rule: loans > 40 actDays
    if (model === "loan" && user.role_name === Role.COLLECTOR && !isTeamLead(user)) {
      const highActDaysLoanIds = await getCollectorLoansWithHighActDays(this.prisma, user.id);

      if (highActDaysLoanIds.length > 0) {
        scopedWhere = {
          ...scopedWhere,
          id: { in: highActDaysLoanIds },
        };
      }
    }

    if (model === "committee" || model === "paymentCommitment") {
      scopedWhere = this.addUserScope(scopedWhere, user, model);
    }

    return scopedWhere;
  }
}
