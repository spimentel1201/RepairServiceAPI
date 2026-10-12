import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QuoteStatus, RepairOrderStatus, Role } from '@prisma/client';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('QuotesService (totales calculados por el servidor)', () => {
  let service: QuotesService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      quote: {
        create: jest.fn().mockResolvedValue({ id: 'q-1', items: [] }),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: 'q-1',
          items: [],
          totalAmount: 110.5,
          ...args.data,
        })),
      },
      repairOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ro-1',
          status: 'IN_PROGRESS',
          endDate: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'ro-1' }),
      },
    };
    prisma = {
      quote: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: 'q-1',
          items: [],
          totalAmount: 110.5,
          ...args.data,
        })),
      },
      repairOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'ro-1' }) },
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'c-1' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1' }) },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    service = new QuotesService(
      prisma as unknown as PrismaService,
      { recalcBilling: jest.fn() } as any,
    );
  });

  function baseDto(overrides: Record<string, unknown> = {}) {
    return {
      repairOrderId: 'ro-1',
      customerId: 'c-1',
      technicianId: 'u-1',
      items: [{ quantity: 1, price: 10 }],
      ...overrides,
    } as any;
  }

  it('calcula el total como suma de items e ignora totalAmount del cliente', async () => {
    await service.create(
      baseDto({
        totalAmount: 1,
        items: [
          { quantity: 2, price: 50 },
          { quantity: 1, price: 10.5 },
        ],
      }),
    );
    expect(tx.quote.create.mock.calls[0][0].data.totalAmount).toBe(110.5);
  });

  it('permite items con precio 0', async () => {
    await service.create(baseDto({ items: [{ quantity: 1, price: 0 }] }));
    expect(tx.quote.create.mock.calls[0][0].data.totalAmount).toBe(0);
  });

  it('rechaza un presupuesto sin items', async () => {
    await expect(service.create(baseDto({ items: [] }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('devuelve 404 si la orden, el cliente o el tecnico no existen', async () => {
    prisma.repairOrder.findUnique.mockResolvedValue(null);
    await expect(service.create(baseDto())).rejects.toThrow(NotFoundException);

    prisma.repairOrder.findUnique.mockResolvedValue({ id: 'ro-1' });
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.create(baseDto())).rejects.toThrow(NotFoundException);

    prisma.customer.findUnique.mockResolvedValue({ id: 'c-1' });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.create(baseDto())).rejects.toThrow(NotFoundException);
  });

  it('rechaza crear con estado INVOICED', async () => {
    await expect(
      service.create(baseDto({ status: QuoteStatus.INVOICED })),
    ).rejects.toThrow(BadRequestException);
  });

  describe('transiciones de estado', () => {
    beforeEach(() => {
      prisma.quote = {
        findUnique: jest.fn(),
        update: jest.fn(async (args: any) => ({
          id: 'q-1',
          repairOrderId: 'ro-1',
          status: args.data.status,
          totalAmount: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        })),
      };
    });

    it('PENDING → APPROVED recalcula el cobro de la orden', async () => {
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q-1',
        status: QuoteStatus.PENDING,
      });
      const result = await service.updateStatus('q-1', QuoteStatus.APPROVED);
      expect(result.status).toBe(QuoteStatus.APPROVED);
      expect((service as any).repairOrders.recalcBilling).toHaveBeenCalledWith(
        'ro-1',
      );
    });

    it('APPROVED → PENDING es solo ADMIN (reversión de error)', async () => {
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q-1',
        repairOrderId: 'ro-1',
        status: QuoteStatus.APPROVED,
      });
      await expect(
        service.updateStatus('q-1', QuoteStatus.PENDING, Role.TECHNICIAN),
      ).rejects.toThrow(ConflictException);
      const result = await service.updateStatus(
        'q-1',
        QuoteStatus.PENDING,
        Role.ADMIN,
      );
      expect(result.status).toBe(QuoteStatus.PENDING);
    });

    it('INVOICED no acepta más transiciones', async () => {
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q-1',
        status: QuoteStatus.INVOICED,
      });
      await expect(
        service.updateStatus('q-1', QuoteStatus.APPROVED),
      ).rejects.toThrow(ConflictException);
    });

    it('update y remove bloquean INVOICED con 409', async () => {
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q-1',
        status: QuoteStatus.INVOICED,
      });
      await expect(service.update('q-1', {} as any)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.remove('q-1')).rejects.toThrow(ConflictException);
    });
  });

  function quoteFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'q-1',
      repairOrderId: 'ro-1',
      customerId: 'c-1',
      technicianId: 'u-1',
      status: QuoteStatus.PENDING,
      totalAmount: 110.5,
      items: [],
      ...overrides,
    } as any;
  }

  // ---- Máquina de transiciones y reflejo en la orden ----

  it('no permite crear presupuestos en estado PAID', async () => {
    await expect(
      service.create(baseDto({ status: QuoteStatus.PAID })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un estado que no existe en el enum', async () => {
    prisma.quote.findUnique.mockResolvedValue(quoteFixture());
    await expect(
      service.updateStatus('q-1', 'PAGADO' as QuoteStatus),
    ).rejects.toThrow(BadRequestException);
  });

  it('no permite PENDING -> PAID (hay que pasar por APPROVED)', async () => {
    prisma.quote.findUnique.mockResolvedValue(quoteFixture());
    await expect(service.updateStatus('q-1', QuoteStatus.PAID)).rejects.toThrow(
      ConflictException,
    );
  });

  it('permite el flujo normal PENDING -> APPROVED', async () => {
    prisma.quote.findUnique.mockResolvedValue(quoteFixture());
    const res = await service.updateStatus('q-1', QuoteStatus.APPROVED);
    expect(res.status).toBe(QuoteStatus.APPROVED);
    expect(prisma.quote.update.mock.calls[0][0].data.status).toBe(
      QuoteStatus.APPROVED,
    );
  });

  it('al pagar refleja el pago en la orden (COMPLETED y recalcula total)', async () => {
    prisma.quote.findUnique.mockResolvedValue(
      quoteFixture({ status: QuoteStatus.APPROVED }),
    );
    const res = await service.updateStatus('q-1', QuoteStatus.PAID);
    expect(res.status).toBe(QuoteStatus.PAID);
    expect(tx.quote.count).toHaveBeenCalled();
    // el total lo fija recalcBilling (quote-to-cash) en la transacción
    expect((service as any).repairOrders.recalcBilling).toHaveBeenCalledWith(
      'ro-1',
      tx,
    );
    const orderData = tx.repairOrder.update.mock.calls[0][0].data;
    expect(orderData.status).toBe(RepairOrderStatus.COMPLETED);
    expect(orderData.endDate).toBeInstanceOf(Date);
  });

  it('una orden solo admite un presupuesto pagado', async () => {
    tx.quote.count.mockResolvedValue(1);
    prisma.quote.findUnique.mockResolvedValue(
      quoteFixture({ status: QuoteStatus.APPROVED }),
    );
    await expect(service.updateStatus('q-1', QuoteStatus.PAID)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.repairOrder.update).not.toHaveBeenCalled();
  });

  it('si la orden ya fue DELIVERED, pagar no la completa ni la degrada', async () => {
    tx.repairOrder.findUnique.mockResolvedValue({
      id: 'ro-1',
      status: RepairOrderStatus.DELIVERED,
      endDate: new Date('2026-01-01'),
    });
    prisma.quote.findUnique.mockResolvedValue(
      quoteFixture({ status: QuoteStatus.APPROVED }),
    );
    await service.updateStatus('q-1', QuoteStatus.PAID);
    expect((service as any).repairOrders.recalcBilling).toHaveBeenCalledWith(
      'ro-1',
      tx,
    );
    expect(tx.repairOrder.update).not.toHaveBeenCalled();
  });

  it('reversiones de estados finales: solo ADMIN', async () => {
    prisma.quote.findUnique.mockResolvedValue(
      quoteFixture({ status: QuoteStatus.PAID }),
    );
    await expect(
      service.updateStatus('q-1', QuoteStatus.APPROVED, Role.TECHNICIAN),
    ).rejects.toThrow(ConflictException);

    const res = await service.updateStatus(
      'q-1',
      QuoteStatus.APPROVED,
      Role.ADMIN,
    );
    expect(res.status).toBe(QuoteStatus.APPROVED);
    // deshacer el pago no toca la orden (corrección manual del admin)
    expect(tx.repairOrder.update).not.toHaveBeenCalled();
  });

  it('bloquea editar y eliminar documentos cobrados (PAID/INVOICED)', async () => {
    prisma.quote.findUnique.mockResolvedValue(
      quoteFixture({ status: QuoteStatus.PAID }),
    );
    await expect(
      service.update('q-1', { items: [{ quantity: 1, price: 1 }] } as any),
    ).rejects.toThrow(ConflictException);
    await expect(service.remove('q-1')).rejects.toThrow(ConflictException);

    prisma.quote.findUnique.mockResolvedValue(
      quoteFixture({ status: QuoteStatus.INVOICED }),
    );
    await expect(service.remove('q-1')).rejects.toThrow(ConflictException);
  });

  it('valida la transicion tambien dentro de PATCH /quotes/:id', async () => {
    prisma.quote.findUnique.mockResolvedValue(quoteFixture());
    await expect(
      service.update('q-1', { status: QuoteStatus.PAID } as any),
    ).rejects.toThrow(ConflictException);
  });
});
