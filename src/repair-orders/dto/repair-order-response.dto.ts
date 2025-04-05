import { ApiProperty } from '@nestjs/swagger';
import { RepairOrderStatus } from '@prisma/client';

export class RepairOrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  repairOrderId: string;

  @ApiProperty({ nullable: true })
  productId: string | null;

  @ApiProperty()
  deviceType: string;

  @ApiProperty()
  brand: string;

  @ApiProperty()
  model: string;

  @ApiProperty({ nullable: true })
  serialNumber: string | null;

  @ApiProperty()
  problemDescription: string;

  @ApiProperty({ type: [String] })
  accessories: string[];

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  price: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RepairOrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  technicianId: string;

  @ApiProperty({ enum: RepairOrderStatus })
  status: RepairOrderStatus;

  @ApiProperty()
  description: string;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty()
  initialReviewCost: number;

  @ApiProperty()
  totalCost: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty({ nullable: true })
  endDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [RepairOrderItemResponseDto] })
  items: RepairOrderItemResponseDto[];

  constructor(partial: Partial<RepairOrderResponseDto>) {
    Object.assign(this, partial);
  }
}