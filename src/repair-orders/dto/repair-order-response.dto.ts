import { RepairOrderStatus } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class RepairOrderItemResponseDto {
  @Expose()
  id: string;

  @Expose()
  repairOrderId: string;

  @Expose()
  productId?: string;

  @Expose()
  deviceType: string;

  @Expose()
  brand: string;

  @Expose()
  model: string;

  @Expose()
  serialNumber?: string;

  @Expose()
  problemDescription: string;

  @Expose()
  accessories: string[];

  @Expose()
  quantity: number;

  @Expose()
  price: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class RepairOrderResponseDto {
  @Expose()
  id: string;

  @Expose()
  customerId: string;

  @Expose()
  technicianId: string;

  @Expose()
  status: RepairOrderStatus;

  @Expose()
  estimatedCompletionDate?: Date;

  @Expose()
  completionDate?: Date;

  @Expose()
  notes?: string;

  @Expose()
  totalAmount: number;

  @Expose()
  @Type(() => RepairOrderItemResponseDto)
  items: RepairOrderItemResponseDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<RepairOrderResponseDto>) {
    Object.assign(this, partial);
  }
}