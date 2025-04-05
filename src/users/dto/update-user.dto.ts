import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * UpdateUserDto - DTO para la actualización de usuarios
 * 
 * Extiende CreateUserDto usando PartialType para hacer
 * todos los campos opcionales, permitiendo actualizaciones
 * parciales de usuarios.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}