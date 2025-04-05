import { ApiProperty } from '@nestjs/swagger';
import { RepairOrderResponseDto } from '../../repair-orders/dto/repair-order-response.dto';
import { QuoteResponseDto } from '../../quotes/dto/quote-response.dto';

export class CustomerHistoryDto {
  @ApiProperty()
  customerId: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty({ type: [RepairOrderResponseDto] })
  repairOrders: RepairOrderResponseDto[];

  @ApiProperty({ type: [QuoteResponseDto] })
  quotes: QuoteResponseDto[];

  constructor(partial: Partial<CustomerHistoryDto>) {
    Object.assign(this, partial);
  }
}