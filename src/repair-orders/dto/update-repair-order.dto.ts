import { PartialType } from '@nestjs/swagger';
import { CreateRepairOrderDto } from './create-repair-order.dto';

export class UpdateRepairOrderDto extends PartialType(CreateRepairOrderDto) {}