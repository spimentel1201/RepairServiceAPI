import { PartialType } from '@nestjs/mapped-types';
import { CreateRepairOrderDto } from './create-repair-order.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { RepairOrderStatus } from '@prisma/client';

export class UpdateRepairOrderDto extends PartialType(CreateRepairOrderDto) {
  @IsEnum(RepairOrderStatus)
  @IsOptional()
  status?: RepairOrderStatus;
}