import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
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
import { RolesGuard } from './auth/guards/roles.guard';
import { AppThrottlerModule } from './throttler/throttler.module';
import { HealthModule } from './health/health.module';

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
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Protección POR DEFECTO: toda ruta exige JWT salvo que lleve @Public().
    // Un controlador nuevo queda cerrado automáticamente (no abiertamente).
    // El orden importa: primero autenticación, luego autorización por roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Serialización global: hace que @Exclude/@Expose de los DTOs (p. ej. el
    // hash de contraseña en UserResponseDto) se apliquen de verdad.
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
