import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO del endpoint POST /users/:id/change-password
 *
 * - `currentPassword` es obligatoria cuando un usuario cambia SU propia
 *   contraseña, y opcional cuando un ADMIN resetea la de otro usuario.
 * - `newPassword` siempre es obligatoria.
 */
export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Contraseña actual (obligatoria al cambiar la propia)',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({
    description: 'Nueva contraseña',
    minLength: 6,
    example: 'NuevaClave123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
