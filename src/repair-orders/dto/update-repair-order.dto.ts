import { PartialType } from '@nestjs/mapped-types';
import { CreateRepairOrderDto } from './create-repair-order.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { RepairOrderStatus } from '@prisma/client';

export class UpdateRepairOrderDto extends PartialType(CreateRepairOrderDto) {
  @ApiPropertyOptional({ description: 'Description of the repair order' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Status of the repair order',
    enum: RepairOrderStatus
  })
  @IsEnum(RepairOrderStatus)
  @IsOptional()
  status?: RepairOrderStatus;
}