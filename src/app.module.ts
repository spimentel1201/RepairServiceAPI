import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { RepairOrdersModule } from './repair-orders/repair-orders.module';
import { QuotesModule } from './quotes/quotes.module';
import { SalesModule } from './sales/sales.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AppThrottlerModule } from './throttler/throttler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    RepairOrdersModule,
    QuotesModule,
    SalesModule,
    AuthModule,
    AppThrottlerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Elimina o comenta esta configuración global
    // {
    //   provide: APP_GUARD,
    //   useClass: JwtAuthGuard,
    // },
  ],
})
export class AppModule {}