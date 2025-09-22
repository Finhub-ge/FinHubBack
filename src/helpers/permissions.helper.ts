import { Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { User } from "@prisma/client";
import { Role } from "src/enums/role.enum";
import { PrismaService } from "src/prisma/prisma.service";

interface AuthenticatedRequest extends Request {
    user: {
        id: number;
        email: string;
        account_id: string;
        role_name: string;
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
            findMany: (args: any) => {
                const scopedWhere = this.addUserScope(args?.where || {}, user, model);
                return this.prisma[model].findMany({
                    ...args,
                    where: scopedWhere
                });
            },

            findUnique: (args: any) => {
                const scopedWhere = this.addUserScope(args?.where || {}, user, model);
                return this.prisma[model].findUnique({
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
                return {
                    ...where,
                    LoanAssignment: {
                        some: {
                            isActive: true,
                            User: { id: user.id }
                        }
                    }
                };
            default:
                return where;
        }
    }
}