import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RepairOrderStatus } from '@prisma/client';

export class CreateRepairOrderItemDto {
  @ApiProperty({ description: 'Tipo de dispositivo(TV, Laptop, etc.)' })
  @IsString()
  @IsNotEmpty()
  deviceType: string;

  @ApiProperty({ description: 'Marca del dispositivo' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ description: 'Modelo del dispositivo' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiPropertyOptional({ description: 'Número de serie del dispositivo' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ description: 'Descripción del problema' })
  @IsString()
  @IsNotEmpty()
  problemDescription: string;

  @ApiPropertyOptional({ description: 'Accesorios incluidos', type: [String] })
  @IsArray()
  @IsOptional()
  accessories?: string[];

  @ApiProperty({ description: 'Cantidad', minimum: 1, default: 1 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Precio unitario', minimum: 0 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'ID del producto relacionado (si aplica)' })
  @IsUUID()
  @IsOptional()
  productId?: string;
}

export class CreateRepairOrderDto {
  @ApiProperty({ description: 'ID del cliente', required: false })
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @ApiProperty({ description: 'ID del técnico asignado',  required: false, nullable: true })
  @IsOptional()
  technicianId?: string | null;

  @ApiPropertyOptional({ 
    description: 'Estado de la orden', 
    enum: RepairOrderStatus,
    default: RepairOrderStatus.RECEIVED
  })
  @IsEnum(RepairOrderStatus)
  @IsOptional()
  status?: RepairOrderStatus;

  @ApiProperty({ description: 'Descripción general de la orden' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Costo inicial de revisión', minimum: 0 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  initialReviewCost?: number;

  @ApiProperty({ 
    description: 'Ítems de la orden de reparación', 
    type: [CreateRepairOrderItemDto] 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRepairOrderItemDto)
  items: CreateRepairOrderItemDto[];
}