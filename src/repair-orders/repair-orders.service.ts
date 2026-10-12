import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRepairOrderDto,
  CreateRepairOrderItemDto,
} from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { RepairOrderResponseDto } from './dto/repair-order-response.dto';
import { Prisma, QuoteStatus, RepairOrderStatus } from '@prisma/client';
import { roundToTwoDecimals, toAmount } from '../common/utils/price.utils';
import { Paged } from '../common/pagination/pagination.utils';

/** Item de orden ya normalizado (cantidad >= 1 y precio definido) */
type ResolvedItem = CreateRepairOrderItemDto & {
  quantity: number;
  price: number;
};

/**
 * Servicio para gestionar órdenes de reparación
 */
@Injectable()
export class RepairOrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Normaliza los ítems de una orden:
   * - `quantity` por defecto 1 (antes podia quedar undefined y el total salia NaN)
   * - `price` tomado del catálogo (`Product.price`) cuando no viene informado
   */
  private async resolveItems(
    items: CreateRepairOrderItemDto[],
  ): Promise<ResolvedItem[]> {
    const productIds = [
      ...new Set(items.map((item) => item.productId).filter((id) => !!id)),
    ] as string[];
    const products =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
          })
        : [];
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    return items.map((item) => {
      const product = item.productId
        ? productMap.get(item.productId)
        : undefined;

      if (item.productId && !product) {
        throw new NotFoundException(
          `Producto con ID ${item.productId} no encontrado`,
        );
      }

      return {
        ...item,
        quantity:
          item.quantity && item.quantity > 0 ? Math.trunc(item.quantity) : 1,
        price:
          item.price !== undefined && item.price !== null
            ? item.price
            : product
              ? toAmount(product.price)
              : 0,
      };
    });
  }

  /**
   * Crea una nueva orden de reparación
   * @param createRepairOrderDto Datos para crear la orden
   * @returns La orden creada
   */
  async create(
    createRepairOrderDto: CreateRepairOrderDto,
  ): Promise<RepairOrderResponseDto> {
    // Verificar si el cliente existe
    const customer = await this.prisma.customer.findUnique({
      where: { id: createRepairOrderDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${createRepairOrderDto.customerId} no encontrado`,
      );
    }

    const items = await this.resolveItems(createRepairOrderDto.items);
    const initialReviewCost = toAmount(createRepairOrderDto.initialReviewCost);
    const itemsTotal = items.reduce(
      (sum, item) => sum + toAmount(item.price) * item.quantity,
      0,
    );

    const repairOrder = await this.prisma.$transaction(async (prisma) => {
      return prisma.repairOrder.create({
        data: {
          customerId: createRepairOrderDto.customerId,
          technicianId: createRepairOrderDto.technicianId || null,
          status: createRepairOrderDto.status || RepairOrderStatus.RECEIVED,
          description: createRepairOrderDto.description,
          notes: createRepairOrderDto.notes,
          initialReviewCost,
          totalCost: roundToTwoDecimals(initialReviewCost + itemsTotal),
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });
    });

    return new RepairOrderResponseDto(repairOrder);
  }

  /**
   * Obtiene una página de órdenes de reparación
   * @param params Filtros opcionales (estado) y paginación
   * @returns Página de órdenes y total de registros que cumplen el filtro
   */
  async findAll(
    params: { status?: RepairOrderStatus; skip?: number; take?: number } = {},
  ): Promise<Paged<RepairOrderResponseDto>> {
    const where: Prisma.RepairOrderWhereInput = params.status
      ? { status: params.status }
      : {};

    const [repairOrders, total] = await Promise.all([
      this.prisma.repairOrder.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          technician: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.repairOrder.count({ where }),
    ]);

    return {
      data: repairOrders.map((order) => new RepairOrderResponseDto(order)),
      total,
    };
  }

  /**
   * Obtiene una orden de reparación por su ID
   * @param id ID de la orden
   * @returns La orden encontrada
   */
  async findOne(id: string): Promise<RepairOrderResponseDto> {
    const repairOrder = await this.prisma.repairOrder.findUnique({
      where: { id },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        quotes: {
          select: { status: true, totalAmount: true },
        },
        sales: {
          select: { totalAmount: true },
        },
      },
    });

    if (!repairOrder) {
      throw new NotFoundException(
        `Orden de reparación con ID ${id} no encontrada`,
      );
    }

    const billing = {
      billedTotal: roundToTwoDecimals(
        repairOrder.sales.reduce((sum, s) => sum + toAmount(s.totalAmount), 0),
      ),
      salesCount: repairOrder.sales.length,
      billableQuotes: repairOrder.quotes.filter(
        (q) =>
          q.status === QuoteStatus.APPROVED ||
          q.status === QuoteStatus.PAID ||
          q.status === QuoteStatus.INVOICED,
      ).length,
      pendingQuotes: repairOrder.quotes.filter(
        (q) => q.status === QuoteStatus.PENDING,
      ).length,
    };

    // `quotes`/`sales` crudos no salen en la respuesta: solo el resumen.
    const { quotes: _quotes, sales: _sales, ...order } = repairOrder;
    void _quotes;
    void _sales;
    return new RepairOrderResponseDto({ ...order, billing });
  }

  /**
   * Obtiene las órdenes de un cliente (paginado)
   * @param customerId ID del cliente
   * @param params Paginación opcional { skip, take }
   * @returns Página + total (total viaja en `X-Total-Count`)
   */
  async findByCustomer(
    customerId: string,
    params: { skip?: number; take?: number } = {},
  ): Promise<Paged<RepairOrderResponseDto>> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${customerId} no encontrado`);
    }

    const where = { customerId };
    const [repairOrders, total] = await Promise.all([
      this.prisma.repairOrder.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.prisma.repairOrder.count({ where }),
    ]);

    return {
      data: repairOrders.map((order) => new RepairOrderResponseDto(order)),
      total,
    };
  }

  /**
   * Obtiene las órdenes asignadas a un técnico (paginado)
   * @param technicianId ID del técnico
   * @param params Paginación opcional { skip, take }
   * @returns Página + total (total viaja en `X-Total-Count`)
   */
  async findByTechnician(
    technicianId: string,
    params: { skip?: number; take?: number } = {},
  ): Promise<Paged<RepairOrderResponseDto>> {
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new NotFoundException(
        `Técnico con ID ${technicianId} no encontrado`,
      );
    }

    const where = { technicianId };
    const [repairOrders, total] = await Promise.all([
      this.prisma.repairOrder.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.prisma.repairOrder.count({ where }),
    ]);

    return {
      data: repairOrders.map((order) => new RepairOrderResponseDto(order)),
      total,
    };
  }

  /**
   * Recalcula el cobro de una orden desde sus presupuestos vigentes.
   *
   * `totalCost` = Σ presupuestos APPROVED + INVOICED (recomputado, nunca
   * acumulado: re-aprobar no duplica). Si hay al menos uno vigente y la orden
   * sigue en RECEIVED/DIAGNOSED, avanza a IN_PROGRESS.
   *
   * @param orderId ID de la orden
   * @param db Cliente Prisma o transacción en curso
   */
  async recalcBilling(
    orderId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const order = await db.repairOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(
        `Orden de reparación con ID ${orderId} no encontrada`,
      );
    }

    const billable = await db.quote.findMany({
      where: {
        repairOrderId: orderId,
        status: {
          in: [QuoteStatus.APPROVED, QuoteStatus.PAID, QuoteStatus.INVOICED],
        },
      },
      select: { totalAmount: true },
    });

    const data: Prisma.RepairOrderUpdateInput = {
      totalCost: roundToTwoDecimals(
        billable.reduce((sum, q) => sum + toAmount(q.totalAmount), 0),
      ),
    };

    if (
      billable.length > 0 &&
      (order.status === RepairOrderStatus.RECEIVED ||
        order.status === RepairOrderStatus.DIAGNOSED)
    ) {
      data.status = RepairOrderStatus.IN_PROGRESS;
    }

    await db.repairOrder.update({ where: { id: orderId }, data });
  }

  /**
   * Actualiza una orden de reparación
   * @param id ID de la orden
   * @param updateRepairOrderDto Datos para actualizar
   * @returns La orden actualizada
   */
  async update(
    id: string,
    updateRepairOrderDto: UpdateRepairOrderDto,
  ): Promise<RepairOrderResponseDto> {
    // Orden actual: verifica existencia y aporta el costo de revision vigente
    const current = await this.findOne(id);

    // Presupuesto pagado: bloquea cambios que alteren dinero (ítems/costo de
    // revisión); además totalCost queda fijado por el pago y no se recalcula.
    const paidQuote = await this.prisma.quote.findFirst({
      where: { repairOrderId: id, status: QuoteStatus.PAID },
      select: { id: true },
    });
    const hasPaidQuote = paidQuote !== null;
    if (
      hasPaidQuote &&
      ((updateRepairOrderDto.items && updateRepairOrderDto.items.length > 0) ||
        updateRepairOrderDto.initialReviewCost !== undefined)
    ) {
      throw new ConflictException(
        'La orden tiene un presupuesto pagado: los ítems y el costo de revisión quedan bloqueados',
      );
    }

    // Verificar si el cliente existe (si se proporciona)
    if (updateRepairOrderDto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: updateRepairOrderDto.customerId },
      });

      if (!customer) {
        throw new NotFoundException(
          `Cliente con ID ${updateRepairOrderDto.customerId} no encontrado`,
        );
      }
    }

    // Verificar si el técnico existe (si se proporciona)
    if (updateRepairOrderDto.technicianId) {
      const technician = await this.prisma.user.findUnique({
        where: { id: updateRepairOrderDto.technicianId },
      });

      if (!technician) {
        throw new NotFoundException(
          `Técnico con ID ${updateRepairOrderDto.technicianId} no encontrado`,
        );
      }
    }

    const initialReviewCost =
      updateRepairOrderDto.initialReviewCost !== undefined
        ? toAmount(updateRepairOrderDto.initialReviewCost)
        : current.initialReviewCost;

    // Actualizar la orden en una transacción
    const updatedOrder = await this.prisma.$transaction(async (prisma) => {
      // Si hay items nuevos, eliminar los existentes y crear los nuevos
      if (updateRepairOrderDto.items && updateRepairOrderDto.items.length > 0) {
        // Eliminar items existentes
        await prisma.repairOrderItem.deleteMany({
          where: { repairOrderId: id },
        });

        const items = await this.resolveItems(updateRepairOrderDto.items);
        const itemsTotal = items.reduce(
          (sum, item) => sum + toAmount(item.price) * item.quantity,
          0,
        );

        // Actualizar la orden con los nuevos items (total recalculado)
        return prisma.repairOrder.update({
          where: { id },
          data: {
            customerId: updateRepairOrderDto.customerId,
            technicianId: updateRepairOrderDto.technicianId,
            status: updateRepairOrderDto.status,
            description: updateRepairOrderDto.description,
            notes: updateRepairOrderDto.notes,
            initialReviewCost,
            totalCost: hasPaidQuote
              ? current.totalCost
              : roundToTwoDecimals(initialReviewCost + itemsTotal),
            // Si el estado cambia a COMPLETED, establecer la fecha de finalización
            endDate:
              updateRepairOrderDto.status === RepairOrderStatus.COMPLETED
                ? new Date()
                : undefined,
            items: {
              create: items,
            },
          },
          include: {
            items: true,
          },
        });
      }

      // Si no hay items nuevos, solo actualizar los datos básicos.
      // totalCost se recalcula por si cambio el costo de revision inicial,
      // salvo que un presupuesto pagado lo haya fijado (no se pisa).
      const itemsTotal = current.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return prisma.repairOrder.update({
        where: { id },
        data: {
          customerId: updateRepairOrderDto.customerId,
          technicianId: updateRepairOrderDto.technicianId,
          status: updateRepairOrderDto.status,
          description: updateRepairOrderDto.description,
          notes: updateRepairOrderDto.notes,
          initialReviewCost,
          totalCost: hasPaidQuote
            ? current.totalCost
            : roundToTwoDecimals(initialReviewCost + itemsTotal),
          // Si el estado cambia a COMPLETED, establecer la fecha de finalización
          endDate:
            updateRepairOrderDto.status === RepairOrderStatus.COMPLETED
              ? new Date()
              : undefined,
        },
        include: {
          items: true,
        },
      });
    });

    return new RepairOrderResponseDto(updatedOrder);
  }

  /**
   * Elimina una orden de reparación
   * @param id ID de la orden
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verificar si la orden existe
    await this.findOne(id);

    // Eliminar la orden y sus items en una transacción
    await this.prisma.$transaction(async (prisma) => {
      // Eliminar items
      await prisma.repairOrderItem.deleteMany({
        where: { repairOrderId: id },
      });

      // Eliminar la orden
      await prisma.repairOrder.delete({
        where: { id },
      });
    });

    return { message: 'Orden de reparación eliminada correctamente' };
  }

  /**
   * Actualiza el estado de una orden
   * @param id ID de la orden
   * @param status Nuevo estado
   * @returns La orden actualizada
   */
  async updateStatus(
    id: string,
    status: RepairOrderStatus,
  ): Promise<RepairOrderResponseDto> {
    // Verificar si la orden existe
    await this.findOne(id);

    const updatedOrder = await this.prisma.repairOrder.update({
      where: { id },
      data: {
        status,
        // Si el estado cambia a COMPLETED, establecer la fecha de finalización
        endDate:
          status === RepairOrderStatus.COMPLETED ? new Date() : undefined,
      },
      include: {
        items: true,
      },
    });

    return new RepairOrderResponseDto(updatedOrder);
  }
}
