import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('QuotesService (totales calculados por el servidor)', () => {
  let service: QuotesService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      quote: { create: jest.fn().mockResolvedValue({ id: 'q-1', items: [] }) },
    };
    prisma = {
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
      expect(
        (service as any).repairOrders.recalcBilling,
      ).toHaveBeenCalledWith('ro-1');
    });

    it('APPROVED → PENDING es 409', async () => {
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q-1',
        status: QuoteStatus.APPROVED,
      });
      await expect(
        service.updateStatus('q-1', QuoteStatus.PENDING),
      ).rejects.toThrow(ConflictException);
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
});
