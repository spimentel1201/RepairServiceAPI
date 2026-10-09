import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { toAmount } from '../../common/utils/price.utils';

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

  constructor(partial: Partial<SaleInvoiceItemDto> | Record<string, unknown>) {
    Object.assign(this, partial);
    this.unitPrice = toAmount(this.unitPrice);
    this.totalPrice = toAmount(this.totalPrice);
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

  constructor(partial: Partial<SaleInvoiceDto> | Record<string, unknown>) {
    Object.assign(this, partial);
    this.subtotal = toAmount(this.subtotal);
    this.tax = toAmount(this.tax);
    this.totalAmount = toAmount(this.totalAmount);
    this.items = (Array.isArray(this.items) ? this.items : []).map(
      (item) => new SaleInvoiceItemDto(item),
    );
  }
}