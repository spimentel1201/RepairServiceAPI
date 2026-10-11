import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RepairOrdersModule } from '../repair-orders/repair-orders.module';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [PrismaModule, RepairOrdersModule, SalesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
