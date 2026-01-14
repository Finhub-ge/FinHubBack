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
import { Reminders_type, TeamMembership_teamRole, User } from "@prisma/client";
import { getUserExport } from "src/helpers/excel.helper";
import { Role } from "src/enums/role.enum";
import { subtractDays } from "src/helpers/date.helper";

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
    const { page, limit, role, isActive, skip, search } = filters;
    const paginationParams = this.paginationService.getPaginationParams({ page, limit, skip });

    const where: any = { deletedAt: null };

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    } else if (!search) {
      where.isActive = true;
    }

    if (search) {
      const terms = search.split(" ").filter(Boolean);

      if (terms.length >= 2) {
        const first = terms[0];
        const last = terms.slice(1).join(" ");

        where.AND = [
          { firstName: { contains: first } },
          { lastName: { contains: last } }
        ];
      } else {
        const term = terms[0];
        const numberId = Number(term);

        where.OR = [
          ...(Number.isInteger(numberId) ? [{ id: numberId }] : []),
          { firstName: { contains: term } },
          { lastName: { contains: term } },
          { email: { contains: term } },
        ];
      }
    }

    if (role) {
      const roleIds = await this.prisma.role.findMany({
        where: { name: { in: role } },
        select: { id: true }
      });

      if (roleIds) {
        where.roleId = { in: roleIds.map(role => role.id) };
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

  async getUsersGroupedByTeamLeader(filters: GetUsersFilterDto, user: any) {
    const { role } = filters;

    // Logged-in user role & team info
    const loggedInRole = user.role_name;
    const isCollectorUser = loggedInRole === Role.COLLECTOR;

    const isLeader = user.team_membership?.some(m => m.teamRole === 'leader');
    const leaderTeamIds = user.team_membership
      ?.filter(m => m.teamRole === 'leader')
      .map(m => m.teamId) || [];

    const filterHasCollector = role?.includes(Role.COLLECTOR);

    // Collector + filter=collector + NOT leader → return []
    if (isCollectorUser && filterHasCollector && !isLeader) {
      return [];
    }

    // Collector + filter=collector + IS leader → restrict to leader teams
    const collectorTeamFilter =
      isCollectorUser && filterHasCollector && isLeader
        ? { teamId: { in: leaderTeamIds } }
        : {};

    // Load memberships from DB
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        deletedAt: null,

        // Apply collector leader restriction if needed
        ...collectorTeamFilter,

        User: {
          deletedAt: null,
          isActive: true,
          ...(role && role.length > 0
            ? { Role: { name: { in: role } } }
            : {}),
        },
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            Role: true,
          },
        },
        Team: true,
      },
    });

    // Group memberships by team
    const teamsMap = new Map<number, any>();

    for (const m of memberships) {
      const { teamId, teamRole, User, Team } = m;

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
      } else {
        team.members.push({
          id: User.id,
          firstName: User.firstName,
          lastName: User.lastName,
          role: User.Role?.name,
        });
      }
    }

    // Convert map to array & remove teams without leader
    let result = Array.from(teamsMap.values()).filter(t => t.teamLeader);

    // Filter members by role=collector if requested
    if (role && role.includes(Role.COLLECTOR)) {
      result = result.map(team => ({
        ...team,
        members: team.members.filter(m => m.role === Role.COLLECTOR),
      }));
    }

    // Add UNASSIGNED users only for Admins / Super-admins
    const isAdmin = ['admin', 'super-admin', 'operational_manager'].includes(loggedInRole);

    if (isAdmin && role && role.length > 0) {
      const assignedUserIds = new Set(memberships.map(m => m.userId));

      const unassignedUsers = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          Role: { name: { in: role } },
          id: { notIn: Array.from(assignedUserIds) },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          Role: true,
        },
      });

      if (unassignedUsers.length > 0) {
        result.push(
          unassignedUsers.map(u => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.Role?.name,
          })),
        );
      }
    }

    // Add dummy "None" and "Pending" entries for lawyer roles
    const isLawyerFilter = role?.some(r =>
      ['lawyer', 'junior_lawyer', 'execution_lawyer', 'super_lawyer'].includes(r)
    );

    if (isLawyerFilter) {
      // Add special team for dummy entries
      result.unshift({
        teamId: -1,
        teamName: 'Special Filters',
        teamLeaderId: null,
        teamLeader: null,
        teamLeaderRole: null,
        members: [
          {
            id: -1,
            firstName: 'None',
            lastName: '(Unassigned)',
            role: 'special'
          },
          {
            id: -2,
            firstName: 'Pending',
            lastName: '(Requested)',
            role: 'special'
          }
        ]
      });
    }
    return result;
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

  async getMarks(user: User) {
    return await this.prisma.loanMarks.findMany({
      where: {
        Loan: {
          LoanAssignment: {
            some: {
              User: { id: user.id }
            }
          }
        },
        deletedAt: null,
      },
      include: {
        Marks: {
          select: {
            id: true,
            title: true
          }
        },
        Loan: {
          select: {
            id: true,
            caseId: true,
            publicId: true,
            Debtor: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
      },
      orderBy: {
        deadline: 'desc'
      }
    });
  }

  async getReminders(user: User, type: any) {
    if (type.type === 'reminders') {
      return await this.prisma.reminders.findMany({
        where: {
          toUserId: user.id,
          deletedAt: null,
          status: true,
          deadline: {
            gte: subtractDays(new Date(), 10)
          },
          type: {
            in: [Reminders_type.Callback]
          },
        },
        include: {
          User_Reminders_toUserIdToUser: {
            select: { id: true, firstName: true, lastName: true }
          },
          Loan: {
            select: {
              id: true,
              caseId: true,
              publicId: true,
              Debtor: { select: { firstName: true, lastName: true } }
            }
          }
        },
        orderBy: {
          deadline: 'asc'
        }
      });
    }
    if (type.type === 'payments') {
      return await this.prisma.reminders.findMany({
        where: {
          fromUserId: user.id,
          deletedAt: null,
          status: true,
          deadline: {
            gte: new Date()
          },
          type: {
            in: [Reminders_type.Agreement, Reminders_type.Promised_to_pay]
          }
        },
        include: {
          User_Reminders_toUserIdToUser: {
            select: { id: true, firstName: true, lastName: true }
          },
          Loan: {
            select: {
              id: true,
              caseId: true,
              publicId: true,
              Debtor: { select: { firstName: true, lastName: true } }
            }
          }
        },
        orderBy: {
          deadline: 'desc'
        }
      });
    }
  }

  async updateReminder(reminderId: number) {
    try {
      await this.prisma.reminders.update({
        where: { id: reminderId },
        data: { status: false }
      });
      return {
        message: 'Reminder updated successfully'
      }
    } catch (error) {
      throw new ForbiddenException('Failed to update reminder');
    }
  }

  async exportUsers(filters: GetUsersFilterDto) {
    const filter = { skip: true, ...filters }
    const users = await this.getAllUsers(filter);
    const columns = ['id', 'firstName', 'lastName', 'plan', 'planYear', 'planMonth']

    return await getUserExport(users.data, columns, 'Users');
  }

  async hashPassword(user: User) {
    const users = await this.prisma.user.findMany({
      where: {
        hash: {
          not: { startsWith: "$argon2" }, // skip already hashed
        },
      },
    });
    for (const user of users) {
      const hash = await argon.hash(user.hash, {});
      await this.prisma.user.update({
        where: { id: user.id },
        data: { hash: hash }
      });
    }
    return {
      message: `hashed ${users.length} users`
    }
  }
}