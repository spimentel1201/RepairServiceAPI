import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ConvertQuoteToSaleDto {
  @ApiProperty({
    enum: PaymentMethod,
    description: 'Método de pago con el que se cobra el presupuesto',
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
