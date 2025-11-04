import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserDto } from "./dto/createUser.dto";
import { EditUserDto } from "./dto/editUser.dto";
import { randomUUID } from "crypto";
import * as argon from 'argon2';
import { generateAccountId } from "src/helpers/accountId.helper";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { GetUsersFilterDto, GetUsersWithPaginationDto } from "./dto/getUsersFilter.dto";
import { PaginationService } from "src/common/services/pagination.service";
import { TeamMembership_teamRole, User } from "@prisma/client";

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private readonly paginationService: PaginationService,
  ) { }

  async createUser(data: CreateUserDto) {
    const randomPwd = randomUUID()
    const hash = await argon.hash(
      data.password,
      {},
    );
    const accountId = generateAccountId(data.first_name)
    const role = await this.prisma.role.findUnique({
      where: { id: data.role_id }
    })

    // save the new user in the db
    try {
      const user = await this.prisma.user.create(
        {
          data: {
            accountId: accountId,
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
            hash,
            roleId: role.id,
            publicId: randomUUID(),
          },
        },
      );

      // Create team membership if team_id exists
      if (data.team_id) {
        await this.prisma.teamMembership.create({
          data: {
            userId: user.id,
            teamId: data.team_id,
            teamRole: data.team_role || 'member'
          }
        });
      }

      // send to email
      return {
        email: user.email,
        accountId: user.accountId,
        password: data.password,
      }
    } catch (error) {
      if (
        error instanceof
        PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2002') {
          throw new ForbiddenException(
            'Credentials taken',
          );
        }
      }
      throw error;
    }
  }

  async getUsersGroupedByRole() {
    return await this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        User: {
          where: {
            deletedAt: null,
            isActive: true
          },
          select: {
            firstName: true,
            lastName: true,
            TeamMembership: {
              select: {
                id: true,
                teamId: true,
                teamRole: true,
                Team: {
                  select: {
                    name: true,
                    description: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        id: 'asc',
      },
    })
  }

  async getAllUsers(filters: GetUsersWithPaginationDto) {
    const { page, limit, role, skip } = filters;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit, skip });

    let where: any = {};

    if (role) {
      const roleId = await this.prisma.role.findFirst({
        where: { name: role },
        select: { id: true }
      });

      if (roleId) {
        where.roleId = roleId.id;
      }
    }

    const data = await this.prisma.user.findMany({
      where,
      ...paginationParams,
      select: {
        id: true,
        email: true,
        accountId: true,
        createdAt: true,
        deletedAt: true,
        firstName: true,
        lastName: true,
        mustChangePassword: true,
        roleId: true,
        isActive: true,
        updatedAt: true,
        Role: true,
        TeamMembership: {
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            teamId: true,
            teamRole: true,
            Team: {
              select: {
                name: true,
                description: true
              }
            }
          }
        }
      }
    });

    const total = await this.prisma.user.count({
      where,
    });

    return this.paginationService.createPaginatedResult(data, total, { page, limit, skip });
  }

  async getUsersByRoleId(roleId: string) {
    return await this.prisma.user.findMany({
      where: {
        roleId: Number(roleId),
        isActive: true,
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        accountId: true,
        createdAt: true,
        deletedAt: true,
        firstName: true,
        lastName: true,
        mustChangePassword: true,
        roleId: true,
        updatedAt: true,
        Role: true,
        TeamMembership: {
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            teamId: true,
            teamRole: true,
            Team: {
              select: {
                name: true,
                description: true
              }
            }
          }
        }
      }
    })
  }

  async editUser(userId: number, data: EditUserDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw new ForbiddenException('User not found');
    }

    // Update user's isActive status (if provided)
    if (data.isActive !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: data.isActive
        }
      });
    }

    // Handle team membership changes
    if (data.team_id !== undefined) {
      // Check if user already has team membership
      const existingTeamMembership = await this.prisma.teamMembership.findFirst({
        where: {
          userId: userId,
          deletedAt: null
        }
      });

      if (existingTeamMembership) {
        // If exists, soft delete the existing membership
        await this.prisma.teamMembership.update({
          where: {
            id: existingTeamMembership.id
          },
          data: {
            deletedAt: new Date()
          }
        });
      }

      // Only create new team membership if team_id is not null
      if (data.team_id !== null) {
        await this.prisma.teamMembership.create({
          data: {
            userId: userId,
            teamId: data.team_id,
            teamRole: data.team_role || 'member'
          }
        });
      }
    }

    return { message: 'User updated successfully' };
  }

  async getUsersGroupedByTeamLeader(filters: GetUsersFilterDto) {
    const { role } = filters;
    // Get all team memberships with their users and team info
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        deletedAt: null,
        User: role ? { Role: { name: role } } : undefined,
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            Role: true
          },
        },
        Team: true,
      },
    });

    // Group by teamId
    const teamsMap = new Map<number, any>();

    for (const membership of memberships) {
      const { teamId, teamRole, User, Team } = membership;

      if (!teamsMap.has(teamId)) {
        teamsMap.set(teamId, {
          teamId,
          teamName: Team?.name,
          teamLeaderId: null,
          teamLeader: null,
          teamLeaderRole: null,
          members: [],
        });
      }

      const team = teamsMap.get(teamId);

      if (teamRole === TeamMembership_teamRole.leader) {
        team.teamLeaderId = User.id;
        team.teamLeader = `${User.firstName} ${User.lastName}`;
        team.teamLeaderRole = User.Role?.name;
        team.teamName = Team.name;
      } else {
        team.members.push({
          id: User.id,
          firstName: User.firstName,
          lastName: User.lastName,
          role: User.Role?.name,
        });
      }
    }

    // Convert to array and filter out teams without leaders (optional)
    let result = Array.from(teamsMap.values()).filter(t => t.teamLeader);

    // ✅ If role = 'collector', return only those teams where members include collectors
    if (role === 'collector') {
      result = result
        .map(team => ({
          ...team,
          members: team.members.filter(m => m.role === 'collector'),
        }))
        .filter(team => team.members.length > 0);
    }

    return result
  }

  async getTasks(user: User) {
    return await this.prisma.tasks.findMany({
      where: {
        toUserId: user.id,
        deletedAt: null
      },
      include: {
        Loan: {
          select: {
            id: true,
            caseId: true,
            publicId: true
          }
        },
        TaskStatus: {
          select: {
            id: true,
            title: true
          }
        },
        User_Tasks_fromUserToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        deadline: 'desc'
      }
    });
  }
}