import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: any;
  let jwt: any;
  let config: any;
  let env: Record<string, string>;

  beforeEach(() => {
    env = {};
    users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('token-firmado') };
    config = {
      get: jest.fn((key: string, def?: string) => env[key] ?? def),
    };
    service = new AuthService(users, jwt, config);
  });

  describe('register', () => {
    it('siempre asigna el rol TECHNICIAN (el ADMIN solo existe via seed)', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue({
        id: 'u-1',
        email: 'tech@taller.com',
        role: Role.TECHNICIAN,
      });

      const result = await service.register({
        email: 'tech@taller.com',
        password: 'clave123456',
        firstName: 'Te',
        lastName: 'Nico',
      } as any);

      const created = users.create.mock.calls[0][0];
      expect(created.role).toBe(Role.TECHNICIAN);
      expect(created.isActive).toBe(true);
      expect(result.role).toBe(Role.TECHNICIAN);
    });

    it('falla con 403 si REGISTRATION_ENABLED=false', async () => {
      env.REGISTRATION_ENABLED = 'false';
      await expect(service.register({} as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });

    it('falla con 409 si el email ya esta en uso', async () => {
      users.findByEmail.mockResolvedValue({ id: 'existente' });
      await expect(
        service.register({ email: 'tech@taller.com' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('devuelve el usuario sin contraseña con credenciales validas', async () => {
      const hash = bcrypt.hashSync('clave-segura', 4);
      users.findByEmail.mockResolvedValue({
        id: 'u-1',
        email: 'a@b.c',
        password: hash,
        role: Role.TECHNICIAN,
      });

      const user = await service.validateUser('a@b.c', 'clave-segura');
      expect(user).not.toBeNull();
      expect(user.id).toBe('u-1');
      expect(user.password).toBeUndefined();
    });

    it('devuelve null con la contraseña incorrecta', async () => {
      const hash = bcrypt.hashSync('clave-segura', 4);
      users.findByEmail.mockResolvedValue({ id: 'u-1', password: hash });
      expect(await service.validateUser('a@b.c', 'otra-clave')).toBeNull();
    });
  });

  describe('login y refreshToken', () => {
    it('login devuelve token y datos del usuario', async () => {
      const result = await service.login({
        id: 'u-1',
        email: 'a@b.c',
        firstName: 'Ana',
        lastName: 'Torres',
        role: Role.TECHNICIAN,
      });

      expect(result.access_token).toBe('token-firmado');
      expect(result.user.id).toBe('u-1');
      expect(jwt.sign).toHaveBeenCalledWith({
        email: 'a@b.c',
        sub: 'u-1',
        role: Role.TECHNICIAN,
      });
    });

    it('refreshToken falla con 401 para un usuario inexistente', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.refreshToken('fantasma')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refreshToken emite un token nuevo para un usuario valido', async () => {
      users.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'a@b.c',
        role: Role.TECHNICIAN,
      });
      const result = await service.refreshToken('u-1');
      expect(result.access_token).toBe('token-firmado');
    });
  });
});
