import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  function contextWith(user?: { role: Role }) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite el acceso cuando el endpoint no exige roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('deniega si el endpoint exige roles y la peticion no trae usuario', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(contextWith(undefined))).toBe(false);
  });

  it('permite si el rol del usuario esta entre los requeridos', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.TECHNICIAN]);
    expect(guard.canActivate(contextWith({ role: Role.TECHNICIAN }))).toBe(
      true,
    );
  });

  it('deniega si el rol del usuario no coincide', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(contextWith({ role: Role.TECHNICIAN }))).toBe(
      false,
    );
  });
});
