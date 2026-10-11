import { Role } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

/**
 * UserResponseDto - DTO para respuestas con datos de usuario
 *
 * Define la estructura de datos de usuario que se envía como respuesta,
 * excluyendo datos sensibles como la contraseña.
 * Utiliza class-transformer para controlar qué campos se serializan.
 */
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Exclude()
  password?: string;

  @Exclude()
  tokenVersion?: number;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  profileImage: string;

  @Expose()
  phone: string;

  @Expose()
  role: Role;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<UserResponseDto> & { password?: string }) {
    Object.assign(this, partial);
    // Doble capa de seguridad: aunque el interceptor no corra, el hash de la
    // contraseña y la versión de sesión nunca se copian a la respuesta.
    delete this.password;
    delete this.tokenVersion;
  }
}
