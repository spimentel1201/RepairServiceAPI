import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { QuoteStatus } from '@prisma/client';

export class CreateQuoteItemDto {
  @ApiProperty({ description: 'Cantidad del ítem' })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ description: 'Precio del ítem' })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiPropertyOptional({ description: 'Descripción del ítem' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateQuoteDto {
  @ApiProperty({ description: 'ID de la orden de reparación asociada' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  repairOrderId: string;

  @ApiProperty({ description: 'ID del cliente' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'ID del técnico' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  technicianId: string;

  @ApiPropertyOptional({ 
    description: 'Estado del presupuesto', 
    enum: QuoteStatus,
    default: QuoteStatus.PENDING
  })
  @IsEnum(QuoteStatus)
  @IsOptional()
  status?: QuoteStatus;

  @ApiProperty({ description: 'Monto total del presupuesto' })
  @IsNumber()
  @IsNotEmpty()
  totalAmount: number;

  @ApiProperty({ 
    description: 'Ítems del presupuesto',
    type: [CreateQuoteItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];
}