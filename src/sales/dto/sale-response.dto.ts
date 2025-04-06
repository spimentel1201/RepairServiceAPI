import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class SaleItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  saleId: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  price: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Additional fields from product
  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  productDescription?: string;

  constructor(partial: Partial<SaleItemResponseDto>) {
    Object.assign(this, partial);
  }
}

export class SaleResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  customerId?: string;

  @ApiPropertyOptional()
  customerName?: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [SaleItemResponseDto] })
  items: SaleItemResponseDto[];

  // Additional fields from user and customer
  @ApiProperty()
  userName: string;

  @ApiPropertyOptional()
  customerFullName?: string;

  constructor(partial: Partial<SaleResponseDto>) {
    Object.assign(this, partial);
  }
}