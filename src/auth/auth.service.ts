import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { AuthDto } from "./dto/auth.dto";
import * as argon from 'argon2';
import { PrismaService } from "src/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { generateAccountId } from "src/helpers/accountId.helper";
import { SignUpSuperAdminDto } from "./dto/signupSuperAdmin.dto";
import { UserSigninDto } from "./dto/userSignin.dto";
import { SetNewPwdDto } from "./dto/setNewPwd.dto";
import { Role } from "src/enums/role.enum";
import { TeamMembership, TeamMembership_teamRole, User } from "@prisma/client";
import { randomUUID } from "crypto"


@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private jwt: JwtService,
  ) { }

  async signupSuperAdmin(dto: SignUpSuperAdminDto) {
    // generate the password hash
    const hash = await argon.hash(
      dto.password,
      {},
    );
    const accountId = generateAccountId(dto.first_name)

    const role = await this.prisma.role.findUnique({
      where: { id: 1 }
    })

    if (!role) {
      throw new BadRequestException('invalid_role_id');
    }
    // save the new user in the db
    try {
      const user = await this.prisma.user.create(
        {
          data: {
            accountId: accountId,
            email: dto.email,
            firstName: dto.first_name,
            lastName: dto.last_name,
            hash,
            roleId: role.id,
            mustChangePassword: false,
            publicId: randomUUID()
          },
        },
      );

      // return this.signToken(user.id, user.email, user.accountId, role.name);
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

  async signinSuperAdmin(dto: AuthDto) {
    const user =
      await this.prisma.user.findFirst({
        where: {
          email: dto.email,
        },
        include: {
          Role: true,
          TeamMembership: true,
          Region: {
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              name: true,
              Team: {
                where: { deletedAt: null },
                select: { id: true }
              }
            }
          }
        },
      });

    // if user does not exist throw exception
    if (!user) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error:
            'The email or password is incorrect.',
        },
        HttpStatus.FORBIDDEN,
        {},
      );
    }

    // Check if user has SUPER_ADMIN role
    if (user.Role.name !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Access denied. Not a SUPER_ADMIN.');
    }

    // compare password
    const pwMatches = await argon.verify(
      user.hash,
      dto.password,
    );
    // if password incorrect throw exception
    if (!pwMatches)
      throw new ForbiddenException(
        'The email or password is incorrect.',
      );

    return this.signToken(user.id, user.email, user.accountId, user.Role.name, user.TeamMembership, user.Region);
  }

  async signinUser(dto: UserSigninDto) {
    const user =
      await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          isActive: true
        },
        select: {
          id: true,
          email: true,
          accountId: true,
          hash: true,
          Role: { select: { name: true } },
          TeamMembership: {
            where: { deletedAt: null },
            //     select: { id: true, teamId: true, teamRole: true }
          },
          Region: {
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              name: true,
              Team: {
                where: { deletedAt: null },
                select: { id: true }
              }
            }
          }
        },
      });

    // if user does not exist throw exception
    if (!user) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error:
            'The email or password is incorrect.',
        },
        HttpStatus.FORBIDDEN,
        {},
      );
    }
    // compare password
    const pwMatches = await argon.verify(
      user.hash,
      dto.password,
    );
    // if password incorrect throw exception
    if (!pwMatches)
      throw new ForbiddenException(
        'The email or password is incorrect.',
      );

    return this.signToken(user.id, user.email, user.accountId, user.Role.name, user.TeamMembership, user.Region);
  }

  async changePwd(user: User, dto: SetNewPwdDto) {
    const userHash =
      await this.prisma.user.findFirst({
        where: {
          id: user.id,
        },
        select: {
          id: true,
          email: true,
          accountId: true,
          hash: true,
          Role: { select: { name: true } },
          TeamMembership: {
            where: { deletedAt: null },
            // select: { id: true, teamId: true, teamRole: true, createdAt: true, updatedAt: true, deletedAt: true, userId: true, joinedAt: true }
          },
          Region: {
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              name: true,
              Team: {
                where: { deletedAt: null },
                select: { id: true }
              }
            }
          }
        },
      });

    // if user does not exist throw exception
    if (!userHash) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error:
            'The email or password is incorrect.',
        },
        HttpStatus.FORBIDDEN,
        {},
      );
    }

    // compare password
    const pwMatches = await argon.verify(
      userHash.hash,
      dto.password,
    );
    // if password incorrect throw exception
    if (!pwMatches)
      throw new ForbiddenException(
        'The email or password is incorrect.',
      );

    const newHash = await argon.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userHash.id },
      data: { hash: newHash, mustChangePassword: false }
    })

    return this.signToken(userHash.id, userHash.email, userHash.accountId, userHash.Role.name, userHash.TeamMembership, userHash.Region);
  }

  async signToken(
    id: number,
    email: string,
    account_id: string,
    role_name: string,
    team_membership: TeamMembership[],
    managed_regions: any[]
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: id,
      email,
      account_id,
      role_name,
      team_membership,
      managed_regions
    };
    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(
      payload,
      {
        expiresIn: '600m',
        secret: secret,
      },
    );

    return {
      access_token: token,
    };
  }

  async getRoles() {
    return await this.prisma.role.findMany({
      where: {
        name: {
          notIn: ['super_admin', 'system']
        },
      },
    });
  }

  async getCurrentUser(user: User) {
    const currentUser =
      await this.prisma.user.findFirst({
        where: {
          id: user.id,
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
            where: { deletedAt: null },
            select: {
              id: true,
              teamId: true,
              teamRole: true,
              Team: { select: { name: true } },
            }
          }
        }
      });

    // if user does not exist throw exception
    if (!currentUser) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error:
            'User not found.',
        },
        HttpStatus.FORBIDDEN,
        {},
      );
    }
    // Add canRequestLawyer property for specific user
    const LAWYER_REQUEST_OVERRIDE_USER_IDS = [58];
    return {
      ...currentUser,
      canRequestLawyer:
        currentUser?.TeamMembership?.[0]?.teamRole === TeamMembership_teamRole.leader ||
        LAWYER_REQUEST_OVERRIDE_USER_IDS.includes(currentUser.id),
    };
  }
}