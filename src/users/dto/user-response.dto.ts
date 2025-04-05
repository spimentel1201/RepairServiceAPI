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
  password: string;

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

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}