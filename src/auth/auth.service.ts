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
import { User } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private jwt: JwtService,


  ) {}

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
            mustChangePassword: false
          },
        },
      );

      return this.signToken(user.id, user.email, user.accountId, role.name);
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
          role: true,
        },
      });

    // if user does not exist throw exception
    if(!user) {
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
    if (user.role.name !== Role.SUPER_ADMIN) {
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
    
    return this.signToken(user.id, user.email, user.accountId, user.role.name);
  }

  async signinUser(dto: UserSigninDto) {
    const user =
      await this.prisma.user.findFirst({
        where: {
          email: dto.email,
        },
        include: {
          role: true,
        },
      });

    // if user does not exist throw exception
    if(!user) {
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

    return this.signToken(user.id, user.email, user.accountId, user.role.name);
  }

  async changePwd(user: User, dto: SetNewPwdDto) {
    const userHash =
      await this.prisma.user.findFirst({
        where: {
          id: user.id,
        },
        include: {
          role: true,
        },
      });

    // if user does not exist throw exception
    if(!userHash) {
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
      where: { id: userHash.id},
      data: { hash: newHash, mustChangePassword: false }
    })

    return this.signToken(userHash.id, userHash.email, userHash.accountId, userHash.role.name);
  }

  async signToken(
    id: number,
    email: string,
    account_id: string,
    role_name: string
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: id,
      email,
      account_id,
      role_name
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
    return await this.prisma.role.findMany()
  }

  async getCurrentUser(user: User) {
    const currentUser =
      await this.prisma.user.findFirst({
        where: {
          id: user.id,
        },
        include: {
          role: true,
        },
      });

    // if user does not exist throw exception
    if(!currentUser) {
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
    return currentUser
  }
}