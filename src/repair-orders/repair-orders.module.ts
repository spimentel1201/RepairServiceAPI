import { Module } from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { RepairOrdersController } from './repair-orders.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Módulo para la gestión de órdenes de reparación
 */
@Module({
  imports: [PrismaModule],
  controllers: [RepairOrdersController],
  providers: [RepairOrdersService],
  exports: [RepairOrdersService],
})
export class RepairOrdersModule {}