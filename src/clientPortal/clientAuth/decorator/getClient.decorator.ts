import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetClient = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const client = request.user;

    return data ? client?.[data] : client;
  },
);