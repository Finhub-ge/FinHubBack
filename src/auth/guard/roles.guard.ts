import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "src/enums/role.enum";
import { ROLES_KEY } from "../decorator/role.decorator";
import { IS_PUBLIC_KEY } from "../decorator/public.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role_name) {
      throw new ForbiddenException('User not authenticated or no roles');
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; 
    }

    return requiredRoles.includes(user.role_name);
  }
}