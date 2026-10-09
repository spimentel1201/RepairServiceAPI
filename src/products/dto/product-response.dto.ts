import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toAmount } from '../../common/utils/price.utils';

export class ProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  cost: number;

  @ApiProperty()
  stock: number;

  @ApiProperty()
  category: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<ProductResponseDto> | Record<string, unknown>) {
    Object.assign(this, partial);
    // Prisma Decimal -> number (el esquema usa DECIMAL(10,2))
    this.price = toAmount(this.price);
    this.cost = toAmount(this.cost);
  }
}
