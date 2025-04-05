import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Nombre completo del cliente' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Correo electrónico del cliente' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Número de teléfono del cliente' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Tipo de documento (DNI, Pasaporte, etc.)' })
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @ApiProperty({ description: 'Número de documento del cliente' })
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @ApiPropertyOptional({ description: 'Dirección del cliente' })
  @IsString()
  @IsOptional()
  address?: string;
}