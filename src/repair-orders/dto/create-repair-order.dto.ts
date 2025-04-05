import { IsNotEmpty, IsString, IsUUID, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { RepairOrderStatus } from '@prisma/client';

export class CreateRepairOrderItemDto {
  @IsString()
  @IsNotEmpty()
  deviceType: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsNotEmpty()
  problemDescription: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accessories?: string[];

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsUUID()
  @IsOptional()
  productId?: string;
}

export class CreateRepairOrderDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsUUID()
  @IsNotEmpty()
  technicianId: string;

  @IsEnum(RepairOrderStatus)
  @IsOptional()
  status?: RepairOrderStatus;

  @IsString()
  @IsNotEmpty()
  description: string; // Add this required field

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  initialReviewCost?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRepairOrderItemDto)
  items: CreateRepairOrderItemDto[];
}