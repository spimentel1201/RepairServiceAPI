import { ConflictException, NotFoundException } from '@nestjs/common';
import { QuoteStatus, RepairOrderStatus } from '@prisma/client';
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
        update: jest.fn().mockResolvedValue({ id: 'ro-1' }),
      },
    };
    prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'c-1' }) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      quote: { findFirst: jest.fn().mockResolvedValue(null) },
      repairOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ro-1',
          status: 'IN_PROGRESS',
          totalCost: 100,
          initialReviewCost: 10,
          items: [],
          quotes: [],
          sales: [],
        }),
      },
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

  describe('recalcBilling', () => {
    beforeEach(() => {
      prisma.repairOrder = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ro-1',
          status: RepairOrderStatus.RECEIVED,
        }),
        update: jest.fn().mockResolvedValue({}),
      };
      prisma.quote = {
        findMany: jest
          .fn()
          .mockResolvedValue([{ totalAmount: 100 }, { totalAmount: 50.5 }]),
      };
    });

    it('suma APPROVED+PAID+INVOICED y avanza RECEIVED → IN_PROGRESS', async () => {
      await service.recalcBilling('ro-1');
      expect(prisma.quote.findMany).toHaveBeenCalledWith({
        where: {
          repairOrderId: 'ro-1',
          status: {
            in: [QuoteStatus.APPROVED, QuoteStatus.PAID, QuoteStatus.INVOICED],
          },
        },
        select: { totalAmount: true },
      });
      expect(prisma.repairOrder.update).toHaveBeenCalledWith({
        where: { id: 'ro-1' },
        data: { totalCost: 150.5, status: RepairOrderStatus.IN_PROGRESS },
      });
    });

    it('no avanza una orden ya COMPLETED y deja total en 0 sin vigentes', async () => {
      prisma.repairOrder.findUnique.mockResolvedValue({
        id: 'ro-1',
        status: RepairOrderStatus.COMPLETED,
      });
      prisma.quote.findMany.mockResolvedValue([]);
      await service.recalcBilling('ro-1');
      expect(prisma.repairOrder.update).toHaveBeenCalledWith({
        where: { id: 'ro-1' },
        data: { totalCost: 0 },
      });
    });

    it('404 si la orden no existe', async () => {
      prisma.repairOrder.findUnique.mockResolvedValue(null);
      await expect(service.recalcBilling('fantasma')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---- Orden con presupuesto pagado ----

  it('rechaza modificar items cuando hay un presupuesto pagado', async () => {
    prisma.quote.findFirst.mockResolvedValue({
      id: 'q-1',
      status: QuoteStatus.PAID,
    });
    await expect(service.update('ro-1', baseDto())).rejects.toThrow(
      ConflictException,
    );
  });

  it('rechaza cambiar el costo de revision con presupuesto pagado', async () => {
    prisma.quote.findFirst.mockResolvedValue({
      id: 'q-1',
      status: QuoteStatus.PAID,
    });
    await expect(
      service.update('ro-1', { initialReviewCost: 99 } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('sin cambios de dinero, no pisa el totalCost fijado por el pago', async () => {
    prisma.quote.findFirst.mockResolvedValue({
      id: 'q-1',
      status: QuoteStatus.PAID,
    });
    await service.update('ro-1', { notes: 'cliente llamado' } as any);
    expect(tx.repairOrder.update.mock.calls[0][0].data.totalCost).toBe(100);
  });

  it('sin presupuesto pagado, totalCost sigue recalculandose', async () => {
    await service.update('ro-1', { initialReviewCost: 20 } as any);
    expect(tx.repairOrder.update.mock.calls[0][0].data.totalCost).toBe(20);
  });
});
