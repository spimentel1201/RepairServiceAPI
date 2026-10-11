import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { toAmount } from '../../common/utils/price.utils';

export class SaleItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  saleId: string;

  @ApiProperty({ nullable: true })
  productId?: string | null;

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
  productDescription?: string | null;

  @ApiPropertyOptional({
    description: 'Snapshot del ítem de servicio (presupuesto facturado)',
  })
  description?: string | null;

  constructor(partial: Partial<SaleItemResponseDto> | Record<string, unknown>) {
    Object.assign(this, partial);
    // Prisma Decimal -> number (el esquema usa DECIMAL(10,2))
    this.price = toAmount(this.price);
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

  @ApiPropertyOptional({
    description: 'Presupuesto que originó la venta (cobro de quote)',
  })
  quoteId?: string | null;

  @ApiPropertyOptional({
    description: 'Orden de reparación que origina el cobro',
  })
  repairOrderId?: string | null;

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

  constructor(partial: Partial<SaleResponseDto> | Record<string, unknown>) {
    Object.assign(this, partial);
    this.totalAmount = toAmount(this.totalAmount);
    this.items = (Array.isArray(this.items) ? this.items : []).map(
      (item) => new SaleItemResponseDto(item),
    );
  }
}
