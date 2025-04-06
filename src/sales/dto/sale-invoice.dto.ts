import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class SaleInvoiceItemDto {
  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  productDescription?: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  totalPrice: number;

  constructor(partial: Partial<SaleInvoiceItemDto>) {
    Object.assign(this, partial);
  }
}

export class SaleInvoiceDto {
  @ApiProperty()
  invoiceNumber: string;

  @ApiProperty()
  date: Date;

  @ApiPropertyOptional()
  customerName?: string;

  @ApiPropertyOptional()
  customerDocument?: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  tax: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty({ type: [SaleInvoiceItemDto] })
  items: SaleInvoiceItemDto[];

  constructor(partial: Partial<SaleInvoiceDto>) {
    Object.assign(this, partial);
  }
}