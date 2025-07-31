import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateUserDto } from "./dto/createUser.dto";
import { randomUUID } from "crypto";
import * as argon from 'argon2';
import { generateAccountId } from "src/helpers/accountId.helper";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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
            roleId: role.id
          },
        },
      );

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
          select: {
            firstName: true
          }
        }
      },
      orderBy: {
        id: 'asc',
      },
    })
  }

  async getAllUsers() {
    return await this.prisma.user.findMany({
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
        Role: true
      }
    })
  }

  async getUsersByRoleId(roleId: string) {
    return await this.prisma.user.findMany({
      where: {
        roleId: Number(roleId)
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
        Role: true
      }
    })
  }
}