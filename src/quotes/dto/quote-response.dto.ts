import { ApiProperty } from '@nestjs/swagger';
import { QuoteStatus } from '@prisma/client';

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

  constructor(partial: Partial<QuoteResponseDto>) {
    Object.assign(this, partial);
  }
}