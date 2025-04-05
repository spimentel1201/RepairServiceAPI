import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;
    
    // Only for development/testing
    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key[0] !== '$' && key !== 'constructor',
    );

    return Promise.all(
      models.map((modelKey) => {
        const modelName = String(modelKey);
        // Use type assertion to tell TypeScript this is a valid model with deleteMany
        const model = this[modelName as keyof this] as unknown as { deleteMany: () => Promise<unknown> };
        return model?.deleteMany?.();
      }),
    );
  }
}