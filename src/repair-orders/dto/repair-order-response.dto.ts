import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepairOrderStatus } from '@prisma/client';

export class RepairOrderItemResponseDto {
  @ApiProperty({ description: 'ID del ítem' })
  id: string;

  @ApiProperty({ description: 'ID de la orden de reparación' })
  repairOrderId: string;

  @ApiProperty({ description: 'Tipo de dispositivo' })
  deviceType: string;

  @ApiProperty({ description: 'Marca del dispositivo' })
  brand: string;

  @ApiProperty({ description: 'Modelo del dispositivo' })
  model: string;

  @ApiPropertyOptional({ description: 'Número de serie del dispositivo' })
  serialNumber?: string;

  @ApiProperty({ description: 'Descripción del problema' })
  problemDescription: string;

  @ApiProperty({ description: 'Accesorios incluidos', type: [String] })
  accessories: string[];

  @ApiProperty({ description: 'Cantidad' })
  quantity: number;

  @ApiProperty({ description: 'Precio unitario' })
  price: number;

  @ApiPropertyOptional({ description: 'ID del producto relacionado (si aplica)' })
  productId?: string;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  updatedAt: Date;

  constructor(partial: Partial<RepairOrderItemResponseDto>) {
    Object.assign(this, partial);
  }
}

export class RepairOrderResponseDto {
  @ApiProperty({ description: 'ID de la orden' })
  id: string;

  @ApiProperty({ description: 'ID del cliente' })
  customerId: string;

  @ApiProperty({ description: 'Nombre del cliente' })
  customerName: string;

  @ApiProperty({ description: 'ID del técnico asignado' })
  technicianId: string;

  @ApiProperty({ description: 'Nombre del técnico asignado' })
  technicianName: string;

  @ApiProperty({ description: 'Estado de la orden', enum: RepairOrderStatus })
  status: RepairOrderStatus;

  @ApiProperty({ description: 'Descripción general de la orden' })
  description: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  notes?: string;

  @ApiProperty({ description: 'Costo inicial de revisión' })
  initialReviewCost: number;

  @ApiProperty({ description: 'Costo total de la reparación' })
  totalCost: number;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Fecha de finalización' })
  endDate?: Date;

  @ApiProperty({ description: 'Ítems de la orden', type: [RepairOrderItemResponseDto] })
  items: RepairOrderItemResponseDto[];

  constructor(partial: Partial<RepairOrderResponseDto>) {
    Object.assign(this, partial);
  }
}