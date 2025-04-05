import { IsNotEmpty, IsString, IsUUID, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { RepairOrderStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRepairOrderItemDto {
  @ApiProperty({ description: 'Type of device (TV, Laptop, etc.)' })
  @IsString()
  @IsNotEmpty()
  deviceType: string;

  @ApiProperty({ description: 'Brand of the device' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ description: 'Model of the device' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiPropertyOptional({ description: 'Serial number of the device' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ description: 'Description of the problem' })
  @IsString()
  @IsNotEmpty()
  problemDescription: string;

  @ApiPropertyOptional({ description: 'List of accessories', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accessories?: string[];

  @ApiProperty({ description: 'Quantity of items', minimum: 1 })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({ description: 'Price per item' })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Product ID if a specific product is used' })
  @IsString()
  @IsUUID()
  @IsOptional()
  productId?: string;
}

export class CreateRepairOrderDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Technician ID' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  technicianId: string;

  @ApiPropertyOptional({ 
    description: 'Status of the repair order',
    enum: RepairOrderStatus,
    default: RepairOrderStatus.RECEIVED
  })
  @IsEnum(RepairOrderStatus)
  @IsOptional()
  status?: RepairOrderStatus;

  @ApiProperty({ description: 'Description of the repair order' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ 
    description: 'Initial cost for reviewing the items',
    default: 0
  })
  @IsNumber()
  @IsOptional()
  initialReviewCost?: number;

  @ApiProperty({ 
    description: 'Items to be repaired',
    type: [CreateRepairOrderItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRepairOrderItemDto)
  items: CreateRepairOrderItemDto[];
}