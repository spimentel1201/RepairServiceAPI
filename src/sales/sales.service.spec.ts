import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, QuoteStatus } from '@prisma/client';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    name: 'Cautin',
    description: 'Cautin 40W',
    price: 50,
    cost: 20,
    stock: 10,
    category: 'herramientas',
    isActive: true,
    imageUrl: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('SalesService', () => {
  let service: SalesService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      sale: { create: jest.fn() },
    };
    prisma = {
      customer: { findUnique: jest.fn() },
      product: { findMany: jest.fn() },
      sale: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      saleItem: { deleteMany: jest.fn() },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    service = new SalesService(prisma as unknown as PrismaService);
  });

  function createdSale(totalAmount = 100) {
    return {
      id: 'sale-1',
      customerId: null,
      customerName: 'Cliente no registrado',
      userId: 'user-1',
      totalAmount,
      paymentMethod: PaymentMethod.CASH,
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
      items: [
        {
          id: 'item-1',
          saleId: 'sale-1',
          productId: 'prod-1',
          quantity: 2,
          price: 50,
          createdAt: new Date('2026-01-02'),
          updatedAt: new Date('2026-01-02'),
        },
      ],
      user: { id: 'user-1', firstName: 'Ana', lastName: 'Torres' },
      customer: null,
    };
  }

  it('el precio sale SIEMPRE del catalogo: ignora items[].price del cliente', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    tx.sale.create.mockResolvedValue(createdSale(100));

    const dto: any = {
      customerName: 'Mostrador',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'prod-1', quantity: 2, price: 999 }],
    };
    const result = await service.create(dto, 'user-1');

    const data = tx.sale.create.mock.calls[0][0].data;
    expect(data.totalAmount).toBe(100); // 50 * 2, no 999 * 2
    expect(data.items.create[0].price).toBe(50);
    expect(result.totalAmount).toBe(100);
    expect(result.items[0].price).toBe(50);
  });

  it('reserva el stock de forma atomica dentro de la transaccion', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ stock: 5 })]);
    tx.sale.create.mockResolvedValue(createdSale(50));

    const dto: any = {
      customerName: 'X',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'prod-1', quantity: 1 }],
    };
    await service.create(dto, 'user-1');

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod-1', stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });
  });

  it('aborta si la reserva atomica no consigue stock (carrera)', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ stock: 5 })]);
    tx.product.updateMany.mockResolvedValue({ count: 0 });

    const dto: any = {
      customerName: 'X',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'prod-1', quantity: 5 }],
    };
    await expect(service.create(dto, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.sale.create).not.toHaveBeenCalled();
  });

  it('rechaza una venta sin items', async () => {
    const dto: any = { paymentMethod: PaymentMethod.CASH, items: [] };
    await expect(service.create(dto, 'u')).rejects.toThrow('al menos un ítem');
  });

  it('rechaza productos inexistentes', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    const dto: any = {
      customerName: 'X',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'prod-1', quantity: 1 }],
    };
    await expect(service.create(dto, 'u')).rejects.toThrow(
      'Uno o más productos no existen',
    );
  });

  it('rechaza un cliente inexistente', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    const dto: any = {
      customerId: 'no-existe',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'prod-1', quantity: 1 }],
    };
    await expect(service.create(dto, 'u')).rejects.toThrow(NotFoundException);
  });

  it('rechaza stock insuficiente antes de la transaccion', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ stock: 1 })]);
    const dto: any = {
      customerName: 'X',
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'prod-1', quantity: 3 }],
    };
    await expect(service.create(dto, 'u')).rejects.toThrow(
      'Stock insuficiente',
    );
  });

  it('usa "Cliente no registrado" cuando no viene ni customerId ni customerName', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    tx.sale.create.mockResolvedValue(createdSale(50));

    const dto: any = {
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: 'prod-1', quantity: 1 }],
    };
    await service.create(dto, 'u');
    expect(tx.sale.create.mock.calls[0][0].data.customerName).toBe(
      'Cliente no registrado',
    );
  });

  describe('getIgvRate', () => {
    function serviceWithIgv(raw?: string) {
      const config = { get: jest.fn().mockReturnValue(raw) };
      return new SalesService(
        prisma as unknown as PrismaService,
        config as any,
      );
    }

    it('defecto 0.18 sin config ni variable', () => {
      expect(service.getIgvRate()).toBe(0.18);
      expect(serviceWithIgv(undefined).getIgvRate()).toBe(0.18);
      expect(serviceWithIgv('').getIgvRate()).toBe(0.18);
    });

    it('respeta IGV_RATE válido', () => {
      expect(serviceWithIgv('0.10').getIgvRate()).toBe(0.1);
      expect(serviceWithIgv('0').getIgvRate()).toBe(0);
    });

    it('fallback 0.18 con valor inválido', () => {
      expect(serviceWithIgv('-1').getIgvRate()).toBe(0.18);
      expect(serviceWithIgv('1').getIgvRate()).toBe(0.18);
      expect(serviceWithIgv('abc').getIgvRate()).toBe(0.18);
    });

    it('generateInvoice usa la tasa configurada', async () => {
      const igvService = serviceWithIgv('0.10');
      prisma.sale.findUnique.mockResolvedValue({
        id: 'sale-12345678',
        totalAmount: 110,
        createdAt: new Date('2026-01-02'),
        customerName: 'X',
        paymentMethod: PaymentMethod.CASH,
        user: { firstName: 'A', lastName: 'B' },
        customer: null,
        items: [],
      });
      const invoice = await igvService.generateInvoice('sale-12345678');
      expect(invoice.subtotal).toBe(100);
      expect(invoice.tax).toBe(10);
      expect(invoice.totalAmount).toBe(110);
    });
  });

  describe('createFromQuote', () => {
    const approvedQuote = {
      id: 'q-1',
      status: QuoteStatus.APPROVED,
      customerId: 'c-1',
      repairOrderId: 'ro-1',
      totalAmount: 250,
      items: [
        { id: 'qi-1', quantity: 1, price: 200, description: 'Mano de obra' },
        { id: 'qi-2', quantity: 1, price: 50, description: 'Repuesto' },
      ],
    };

    function mockQuoteTx(quote: any, existingSale: any = null) {
      const qtx = {
        quote: {
          findUnique: jest.fn().mockResolvedValue(quote),
          update: jest.fn().mockResolvedValue({}),
        },
        sale: {
          findUnique: jest.fn().mockResolvedValue(existingSale),
          create: jest.fn(async (args: any) => ({
            id: 's-1',
            ...args.data,
            items: args.data.items.create.map((it: any, i: number) => ({
              id: `si-${i}`,
              saleId: 's-1',
              productId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...it,
            })),
            user: { firstName: 'A', lastName: 'B' },
            customer: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        },
      };
      prisma.$transaction = jest.fn(async (fn: any) => fn(qtx));
      return qtx;
    }

    it('factura un APPROVED: crea venta, marca INVOICED y enlaza quote/orden', async () => {
      const qtx = mockQuoteTx(approvedQuote);
      const result = await service.createFromQuote(
        'q-1',
        PaymentMethod.YAPE,
        'u-1',
      );

      expect(qtx.sale.create).toHaveBeenCalled();
      const data = qtx.sale.create.mock.calls[0][0].data;
      expect(data.quoteId).toBe('q-1');
      expect(data.repairOrderId).toBe('ro-1');
      expect(data.totalAmount).toBe(250);
      expect(data.paymentMethod).toBe(PaymentMethod.YAPE);
      expect(data.items.create).toHaveLength(2);
      expect(qtx.quote.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: { status: QuoteStatus.INVOICED },
      });
      expect(result.quoteId).toBe('q-1');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].productName).toBe('Mano de obra');
    });

    it('404 si el presupuesto no existe', async () => {
      mockQuoteTx(null);
      await expect(
        service.createFromQuote('fantasma', PaymentMethod.CASH, 'u-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('409 si no está APPROVED', async () => {
      mockQuoteTx({ ...approvedQuote, status: QuoteStatus.PENDING });
      await expect(
        service.createFromQuote('q-1', PaymentMethod.CASH, 'u-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('409 anti doble-cobro si ya existe venta', async () => {
      mockQuoteTx(approvedQuote, { id: 's-vieja' });
      await expect(
        service.createFromQuote('q-1', PaymentMethod.CASH, 'u-1'),
      ).rejects.toThrow(/ya fue facturado/);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
