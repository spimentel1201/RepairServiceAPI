import { NotFoundException } from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RepairOrdersService (totales y normalizacion de items)', () => {
  let service: RepairOrdersService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      repairOrder: {
        create: jest.fn().mockResolvedValue({ id: 'ro-1', items: [] }),
      },
    };
    prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'c-1' }) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    service = new RepairOrdersService(prisma as unknown as PrismaService);
  });

  function baseDto(overrides: Record<string, unknown> = {}) {
    return {
      customerId: 'c-1',
      description: 'Licuadora no enciende',
      initialReviewCost: 10,
      items: [{ productId: 'p-1', quantity: 2 }],
      ...overrides,
    } as any;
  }

  it('totalCost = initialReviewCost + items (precio de catalogo si el item no trae price)', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p-1', price: 25 }]);

    await service.create(baseDto());
    const data = tx.repairOrder.create.mock.calls[0][0].data;
    expect(data.totalCost).toBe(60); // 10 + (25 * 2)
    expect(data.items.create[0].price).toBe(25);
    expect(data.items.create[0].quantity).toBe(2);
  });

  it('quantity por defecto 1 y el precio explicito del item se respeta', async () => {
    await service.create(
      baseDto({
        initialReviewCost: 0,
        items: [{ description: 'Mano de obra', price: 80 }],
      }),
    );
    const data = tx.repairOrder.create.mock.calls[0][0].data;
    expect(data.items.create[0].quantity).toBe(1);
    expect(data.totalCost).toBe(80);
  });

  it('acepta precios en cero (revision inicial y item)', async () => {
    await expect(
      service.create(
        baseDto({
          initialReviewCost: 0,
          items: [{ description: 'Garantia', price: 0 }],
        }),
      ),
    ).resolves.toBeDefined();
    expect(tx.repairOrder.create.mock.calls[0][0].data.totalCost).toBe(0);
  });

  it('devuelve 404 si el cliente no existe', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.create(baseDto({ customerId: 'x' }))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('devuelve 404 si un producto referenciado no existe', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await expect(service.create(baseDto())).rejects.toThrow(NotFoundException);
  });
});
