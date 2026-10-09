import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreateSaleItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Cantidad del producto', minimum: 1 })
  @IsNumber()
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({
    description:
      'Ignorado: el precio siempre se toma del catálogo (Product.price). Se acepta por compatibilidad con clientes antiguos',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'ID del cliente (opcional para ventas a clientes no registrados)' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Nombre del cliente no registrado' })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({ description: 'Método de pago', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiProperty({ description: 'Ítems de la venta', type: [CreateSaleItemDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'La venta debe tener al menos un ítem' })
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}