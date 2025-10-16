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

  private getScopedModel(model: string, user: AuthenticatedRequest['user']) {
    return {
      findMany: async (args: any) => {
        let scopedWhere = this.addUserScope(args?.where || {}, user, model);
        // Special logic for collectors with loans > 40 actDays
        if (model === 'loan' && user.role_name === Role.COLLECTOR && !isTeamLead(user)) {
          const highActDaysLoanIds = await getCollectorLoansWithHighActDays(this.prisma, user.id);

          if (highActDaysLoanIds.length > 0) {
            scopedWhere = {
              ...scopedWhere,
              id: { in: highActDaysLoanIds }
            };
          }
        }

        return this.prisma[model].findMany({
          ...args,
          where: scopedWhere
        });
      },

      findFirst: async (args: any) => {
        let scopedWhere = this.addUserScope(args?.where || {}, user, model);
        // Special logic for collectors with loans > 40 actDays
        if (model === 'loan' && user.role_name === Role.COLLECTOR && !isTeamLead(user)) {
          const highActDaysLoanIds = await getCollectorLoansWithHighActDays(this.prisma, user.id);
          if (highActDaysLoanIds.length > 0) {
            scopedWhere = {
              ...scopedWhere,
              id: { in: highActDaysLoanIds }
            };
          }
        }

        return this.prisma[model].findFirst({
          ...args,
          where: scopedWhere
        });
      },

      count: async (args: any) => {
        let scopedWhere = this.addUserScope(args?.where || {}, user, model);

        // Special logic for collectors with loans > 40 actDays
        if (model === 'loan' && user.role_name === Role.COLLECTOR && !isTeamLead(user)) {
          const highActDaysLoanIds = await getCollectorLoansWithHighActDays(this.prisma, user.id);

          if (highActDaysLoanIds.length > 0) {
            scopedWhere = {
              ...scopedWhere,
              id: { in: highActDaysLoanIds }
            };
          }
        }

        return this.prisma[model].count({
          ...args,
          where: scopedWhere
        });
      }
    };
  }

  private addUserScope(where: any, user: AuthenticatedRequest['user'], model: string) {
    if (user.role_name === Role.SUPER_ADMIN || user.role_name === Role.ADMIN) {
      return where;
    }

    switch (model) {
      case 'loan':
        const activeTeamMembership = getActiveTeamMembership(user);
        const teamLead = isTeamLead(user);
        const teamId = activeTeamMembership?.teamId;

        if (user.role_name === Role.COLLECTOR && teamLead && teamId) {
          // Team lead: see all loans assigned to team members
          return {
            ...where,
            LoanAssignment: {
              some: {
                isActive: true,
                User: {
                  TeamMembership: {
                    some: {
                      teamId: teamId, // Team lead's team
                      deletedAt: null
                    }
                  }
                }
              }
            }
          };
        } else if (user.role_name === Role.COLLECTOR) {
          // Regular collector: see only their own loans
          return {
            ...where,
            LoanAssignment: {
              some: {
                isActive: true,
                User: { id: user.id }
              }
            }
          };
        } else {
          // Other roles: see their assigned loans
          return {
            ...where,
            LoanAssignment: {
              some: {
                isActive: true,
                User: { id: user.id }
              }
            }
          };
        }
      default:
        return where;
    }
  }
}