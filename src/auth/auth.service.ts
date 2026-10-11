import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { Role } from '@prisma/client';

/**
 * AuthService - Servicio de autenticación y autorización
 *
 * Este servicio maneja:
 * - Validación de credenciales de usuario
 * - Inicio de sesión y generación de tokens JWT
 * - Registro de nuevos usuarios
 * - Renovación de tokens
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Valida las credenciales de un usuario
   * @param email - Correo electrónico del usuario
   * @param password - Contraseña del usuario
   * @returns Usuario sin contraseña si las credenciales son válidas, null en caso contrario
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Genera un token JWT para un usuario autenticado
   * @param user - Usuario autenticado
   * @returns Token de acceso y datos básicos del usuario
   */
  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      // Versión de sesión: permite revocar sin afectar tokens viejos sin `tv`.
      tv: user.tokenVersion ?? 0,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Registra un nuevo usuario en el sistema
   *
   * SEGURIDAD: el rol siempre es TECHNICIAN. Nunca se acepta un rol del
   * cliente (el DTO ni siquiera lo expone y ValidationPipe lo rechazaría).
   * El usuario ADMIN se crea exclusivamente con `npm run seed` (ver prisma/seed.ts).
   *
   * @param registerDto - Datos del nuevo usuario
   * @returns Usuario creado sin contraseña
   * @throws ForbiddenException si el registro está deshabilitado (REGISTRATION_ENABLED=false)
   * @throws ConflictException si el correo ya está en uso
   */
  async register(registerDto: RegisterDto) {
    // Permite cerrar el registro en producción sin redeploy del código
    const registrationEnabled = String(
      this.configService.get('REGISTRATION_ENABLED', 'true'),
    ).toLowerCase();
    if (['false', '0', 'no'].includes(registrationEnabled)) {
      throw new ForbiddenException(
        'El registro de usuarios está deshabilitado',
      );
    }

    // Verifica si el usuario ya existe
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Crea un nuevo usuario con rol TECHNICIAN por defecto
    const user = await this.usersService.create({
      ...registerDto,
      role: Role.TECHNICIAN,
      profileImage: '',
      isActive: true,
    });

    // Retorna el usuario sin contraseña
    return user;
  }

  /**
   * Renueva el token JWT de un usuario
   * @param userId - ID del usuario
   * @returns Nuevo token de acceso
   * @throws UnauthorizedException si el usuario no es válido
   */
  async refreshToken(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    const full = await this.usersService.findByEmail(user.email);
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      tv: full?.tokenVersion ?? 0,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * Cierra todas las sesiones del usuario incrementando `tokenVersion`.
   * Los tokens emitidos antes (con `tv` menor) dejan de validar.
   * Es opt-in: el frontend existente que nunca llama aquí no se ve afectado.
   * @param userId - ID del usuario
   * @returns Mensaje de confirmación
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.revokeSessions(userId);
    return { message: 'Sesiones cerradas correctamente' };
  }
}
