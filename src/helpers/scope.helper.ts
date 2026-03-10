import { Injectable } from "@nestjs/common";
import { Role } from "src/enums/role.enum";
import { LoanService } from "src/loan/loan.service";
import { getRegionalTeamIds, isRegionalManager } from "./loan.helper";

@Injectable()
export class ScopeService {
  constructor(private readonly loanService: LoanService) { }

  async resolveCollectorScope(
    user: any,
    requestedCollectorIds?: number[]
  ): Promise<number[] | undefined> {

    const isCollector = user.role_name === Role.COLLECTOR;

    const isAdminLike = [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.OPERATIONAL_MANAGER,
      Role.CONTROLLER,
    ].includes(user.role_name);

    // 1. Collector Logic
    if (isCollector) {
      const isLeader = user.team_membership?.some(
        (tm: any) => tm.teamRole === 'leader'
      );
      const regionalManager = isRegionalManager(user);
      const regionalTeamIds = regionalManager ? getRegionalTeamIds(user) : [];

      // Check if regional manager but not in any team
      const userInTeam = user.team_membership?.some((tm: any) => tm.deletedAt === null);

      // Regional manager without team → can see regional team members + himself
      if (regionalManager && regionalTeamIds.length > 0 && !userInTeam) {
        const teamMemberIds = await this.loanService.getTeamMemberIds(user);

        // Add user's own ID if not already included
        const allIds = teamMemberIds.includes(user.id)
          ? teamMemberIds
          : [...teamMemberIds, user.id];

        if (requestedCollectorIds?.length) {
          // intersection
          return requestedCollectorIds.filter(id => allIds.includes(id));
        }

        return allIds;
      }

      // Collector but NOT leader → only himself
      if (!isLeader) {
        return [user.id];
      }

      // Leader → can see team
      const teamMemberIds = await this.loanService.getTeamMemberIds(user);

      if (requestedCollectorIds?.length) {
        // intersection
        return requestedCollectorIds.filter(id =>
          teamMemberIds.includes(id)
        );
      }

      return teamMemberIds;
    }

    // 2. Admin-like roles
    if (isAdminLike) {
      return requestedCollectorIds?.length
        ? requestedCollectorIds
        : undefined; // undefined = no filter (all)
    }

    // 3. Any other role → only himself
    return requestedCollectorIds?.length
      ? requestedCollectorIds
      : [user.id];
  }
}