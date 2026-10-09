import { ApiProperty } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';
import { toAmount } from '../../common/utils/price.utils';

export class QuoteItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  quoteId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  price: number;

  @ApiProperty({ nullable: true })
  description?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<QuoteItemResponseDto> | Record<string, unknown>) {
    Object.assign(this, partial);
    // Prisma Decimal -> number (el esquema usa DECIMAL(10,2))
    this.price = toAmount(this.price);
  }
}

export class QuoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  repairOrderId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  technicianId: string;

  @ApiProperty({ enum: QuoteStatus })
  status: QuoteStatus;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [QuoteItemResponseDto] })
  items: QuoteItemResponseDto[];

  constructor(partial: Partial<QuoteResponseDto> | Record<string, unknown>) {
    Object.assign(this, partial);
    this.totalAmount = toAmount(this.totalAmount);
    this.items = (Array.isArray(this.items) ? this.items : []).map(
      (item) => new QuoteItemResponseDto(item),
    );
  }
}