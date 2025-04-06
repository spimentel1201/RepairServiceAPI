import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreateSaleItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Cantidad del producto', minimum: 1 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Precio unitario del producto', minimum: 0 })
  @IsNumber()
  @IsPositive()
  price: number;
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
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}