import { Injectable } from "@nestjs/common";
import { Role } from "src/enums/role.enum";
import { LoanService } from "src/loan/loan.service";

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
    ].includes(user.role_name);

    // 1. Collector Logic
    if (isCollector) {
      const isLeader = user.team_membership?.some(
        (tm: any) => tm.teamRole === 'leader'
      );

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