import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ArgoUser } from '../types/argo-user.type.js';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ArgoUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
