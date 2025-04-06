import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsBoolean, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Descripción detallada del producto' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Precio de venta del producto', minimum: 0 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ description: 'Costo de adquisición del producto', minimum: 0 })
  @IsNumber()
  @IsPositive()
  cost: number;

  @ApiProperty({ description: 'Cantidad disponible en inventario', minimum: 0 })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiProperty({ description: 'Categoría del producto (ej: Repuestos, Accesorios, etc.)' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ description: 'Estado del producto (activo/inactivo)', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'URL de la imagen del producto' })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}