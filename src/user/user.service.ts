import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserDto } from "./dto/createUser.dto";
import { EditUserDto } from "./dto/editUser.dto";
import { randomUUID } from "crypto";
import * as argon from 'argon2';
import { generateAccountId } from "src/helpers/accountId.helper";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { GetUsersFilterDto } from "./dto/getUsersFilter.dto";

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
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

  async getAllUsers(filters: GetUsersFilterDto) {
    const { role } = filters;

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

    return this.prisma.user.findMany({
      where,
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

      // Create new team membership
      await this.prisma.teamMembership.create({
        data: {
          userId: userId,
          teamId: data.team_id,
          teamRole: data.team_role || 'member'
        }
      });
    }

    return { message: 'User updated successfully' };
  }
}