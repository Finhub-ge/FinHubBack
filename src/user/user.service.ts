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
  ) {}

  async createUser(data: CreateUserDto) {
    const randomPwd = randomUUID()
    const hash = await argon.hash(
      randomPwd,
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
            account_id: accountId,
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            hash,
            role_id: role.id
          },
        },
      );

      // send to email
      return {
        email: user.email,
        accountId: user.account_id,
        password: randomPwd
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
        users: {
          select: {
            first_name: true
          }
        }
      },
      orderBy: {
        id: 'asc',
      },
    })
  }

  async getUsersByRoleId(roleId: string) {
    return await this.prisma.user.findMany({
      where: { 
        role_id: Number(roleId) 
      },
      include: { 
        role: true 
      },
    })
  }
}