import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepairOrdersService } from '../repair-orders/repair-orders.service';
import { CreateQuoteDto, CreateQuoteItemDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { QuoteStatus, RepairOrderStatus, Role } from '@prisma/client';
import { roundToTwoDecimals, toAmount } from '../common/utils/price.utils';
import { Paged } from '../common/pagination/pagination.utils';

/**
 * Máquina de transiciones de estados del presupuesto (ciclo quote-to-cash):
 * PENDING → APPROVED → (PAID) → INVOICED. PAID registra un pago sin
 * documento; INVOICED solo lo pone el cobro (`convert-to-sale`) y es
 * terminal. REJECTED y EXPIRED se reabren a PENDING.
 */
const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.PENDING]: [
    QuoteStatus.APPROVED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
  ],
  [QuoteStatus.APPROVED]: [
    QuoteStatus.PAID,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
  ],
  [QuoteStatus.PAID]: [],
  [QuoteStatus.REJECTED]: [QuoteStatus.PENDING],
  [QuoteStatus.EXPIRED]: [QuoteStatus.PENDING],
  [QuoteStatus.INVOICED]: [],
};

/**
 * Reversiones permitidas solo a un ADMIN (corrección de errores):
 * deshacer una aprobación o deshacer un pago registrado.
 */
const ADMIN_REVERSALS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.PENDING]: [],
  [QuoteStatus.APPROVED]: [QuoteStatus.PENDING],
  [QuoteStatus.REJECTED]: [],
  [QuoteStatus.EXPIRED]: [],
  [QuoteStatus.PAID]: [QuoteStatus.APPROVED],
  [QuoteStatus.INVOICED]: [],
};

/** Estados cobrados: el documento queda congelado (solo lectura). */
const LOCKED_STATES: QuoteStatus[] = [QuoteStatus.PAID, QuoteStatus.INVOICED];

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private repairOrders: RepairOrdersService,
  ) {}

  /**
   * El total de un presupuesto siempre lo calcula el servidor a partir de sus
   * ítems: `Σ (precio * cantidad)` redondeado a 2 decimales. El campo
   * `totalAmount` que envie el cliente se ignora.
   */
  private calculateTotal(items: CreateQuoteItemDto[]): number {
    return roundToTwoDecimals(
      items.reduce(
        (sum, item) => sum + toAmount(item.price) * item.quantity,
        0,
      ),
    );
  }

  /**
   * Crea un nuevo presupuesto
   * @param createQuoteDto Datos para crear el presupuesto
   * @returns El presupuesto creado
   */
  async create(createQuoteDto: CreateQuoteDto): Promise<QuoteResponseDto> {
    // Verificar que al menos hay un ítem
    if (!createQuoteDto.items || createQuoteDto.items.length === 0) {
      throw new BadRequestException(
        'El presupuesto debe tener al menos un ítem',
      );
    }

    // Verificar si la orden de reparación existe
    const repairOrder = await this.prisma.repairOrder.findUnique({
      where: { id: createQuoteDto.repairOrderId },
    });

    if (!repairOrder) {
      throw new NotFoundException(
        `Orden de reparación con ID ${createQuoteDto.repairOrderId} no encontrada`,
      );
    }

    // Verificar si el cliente existe
    const customer = await this.prisma.customer.findUnique({
      where: { id: createQuoteDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${createQuoteDto.customerId} no encontrado`,
      );
    }

    // Verificar si el técnico existe
    const technician = await this.prisma.user.findUnique({
      where: { id: createQuoteDto.technicianId },
    });

    if (!technician) {
      throw new NotFoundException(
        `Técnico con ID ${createQuoteDto.technicianId} no encontrado`,
      );
    }

    // PAID e INVOICED son eventos de cobro: no se crean directamente (el
    // pago va por PATCH /:id/status y el cobro por convert-to-sale). Un
    // presupuesto puede nacer PENDING o, para migraciones, APPROVED.
    const initialStatus = createQuoteDto.status ?? QuoteStatus.PENDING;
    if (
      initialStatus === QuoteStatus.PAID ||
      initialStatus === QuoteStatus.INVOICED
    ) {
      throw new BadRequestException(
        'Un presupuesto no puede crearse como PAID o INVOICED: usa PATCH /quotes/:id/status o convert-to-sale',
      );
    }

    // Crear el presupuesto con sus ítems en una transacción
    const quote = await this.prisma.$transaction(async (prisma) => {
      // Crear el presupuesto (total recalculado por el servidor)
      const newQuote = await prisma.quote.create({
        data: {
          repairOrderId: createQuoteDto.repairOrderId,
          customerId: createQuoteDto.customerId,
          technicianId: createQuoteDto.technicianId,
          status: initialStatus,
          totalAmount: this.calculateTotal(createQuoteDto.items),
          items: {
            create: createQuoteDto.items.map((item) => ({
              quantity: item.quantity,
              price: toAmount(item.price),
              description: item.description,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return newQuote;
    });

    // Si nace aprobado, la orden refleja el cobro desde el inicio.
    if (quote.status === QuoteStatus.APPROVED) {
      await this.repairOrders.recalcBilling(quote.repairOrderId);
    }

    return new QuoteResponseDto(quote);
  }

  /**
   * Obtiene una página de presupuestos
   * @param params Paginación
   * @returns Página de presupuestos y total de registros
   */
  async findAll(
    params: { skip?: number; take?: number } = {},
  ): Promise<Paged<QuoteResponseDto>> {
    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          repairOrder: {
            include: {
              items: true,
            },
          },
          customer: true,
          technician: true,
        },
      }),
      this.prisma.quote.count(),
    ]);

    return { data: quotes.map((quote) => new QuoteResponseDto(quote)), total };
  }

  /**
   * Obtiene un presupuesto por su ID
   * @param id ID del presupuesto
   * @returns El presupuesto encontrado
   */
  async findOne(id: string): Promise<QuoteResponseDto> {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        items: true,
        repairOrder: {
          include: {
            items: true,
          },
        },
        customer: true,
        technician: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Presupuesto con ID ${id} no encontrado`);
    }

    return new QuoteResponseDto(quote);
  }

  /**
   * Obtiene los presupuestos de una orden de reparación (paginado)
   * @param repairOrderId ID de la orden de reparación
   * @param params Paginación opcional { skip, take }
   * @returns Página + total (total viaja en `X-Total-Count`)
   */
  async findByRepairOrder(
    repairOrderId: string,
    params: { skip?: number; take?: number } = {},
  ): Promise<Paged<QuoteResponseDto>> {
    const repairOrder = await this.prisma.repairOrder.findUnique({
      where: { id: repairOrderId },
    });

    if (!repairOrder) {
      throw new NotFoundException(
        `Orden de reparación con ID ${repairOrderId} no encontrada`,
      );
    }

    const where = { repairOrderId };
    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return {
      data: quotes.map((quote) => new QuoteResponseDto(quote)),
      total,
    };
  }

  /**
   * Obtiene los presupuestos de un cliente (paginado)
   * @param customerId ID del cliente
   * @param params Paginación opcional { skip, take }
   * @returns Página + total (total viaja en `X-Total-Count`)
   */
  async findByCustomer(
    customerId: string,
    params: { skip?: number; take?: number } = {},
  ): Promise<Paged<QuoteResponseDto>> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${customerId} no encontrado`);
    }

    const where = { customerId };
    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return {
      data: quotes.map((quote) => new QuoteResponseDto(quote)),
      total,
    };
  }

  /**
   * Actualiza un presupuesto
   * @param id ID del presupuesto
   * @param updateQuoteDto Datos para actualizar
   * @returns El presupuesto actualizado
   */
  async update(
    id: string,
    updateQuoteDto: UpdateQuoteDto,
    role: Role = Role.ADMIN,
  ): Promise<QuoteResponseDto> {
    const existing = await this.findOne(id);

    // Documentos cobrados (PAID/INVOICED) = congelados: se corrigen
    // revirtiendo el estado, no editando el documento.
    if (LOCKED_STATES.includes(existing.status)) {
      throw new ConflictException(
        existing.status === QuoteStatus.INVOICED
          ? 'Un presupuesto INVOICED no puede editarse porque ya generó una venta'
          : `El presupuesto está en estado ${existing.status} y no puede modificarse; revierta el estado primero`,
      );
    }

    // Si viene un estado nuevo, debe ser una transición válida
    if (
      updateQuoteDto.status !== undefined &&
      updateQuoteDto.status !== existing.status
    ) {
      this.assertTransition(existing.status, updateQuoteDto.status, role);
    }

    // Verificar si la orden de reparación existe (si se proporciona)
    if (updateQuoteDto.repairOrderId) {
      const repairOrder = await this.prisma.repairOrder.findUnique({
        where: { id: updateQuoteDto.repairOrderId },
      });

      if (!repairOrder) {
        throw new NotFoundException(
          `Orden de reparación con ID ${updateQuoteDto.repairOrderId} no encontrada`,
        );
      }
    }

    // Verificar si el cliente existe (si se proporciona)
    if (updateQuoteDto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: updateQuoteDto.customerId },
      });

      if (!customer) {
        throw new NotFoundException(
          `Cliente con ID ${updateQuoteDto.customerId} no encontrado`,
        );
      }
    }

    // Verificar si el técnico existe (si se proporciona)
    if (updateQuoteDto.technicianId) {
      const technician = await this.prisma.user.findUnique({
        where: { id: updateQuoteDto.technicianId },
      });

      if (!technician) {
        throw new NotFoundException(
          `Técnico con ID ${updateQuoteDto.technicianId} no encontrado`,
        );
      }
    }

    // Actualizar el presupuesto en una transacción
    const updatedQuote = await this.prisma.$transaction(async (prisma) => {
      // Si hay ítems nuevos, eliminar los existentes y crear los nuevos
      if (updateQuoteDto.items && updateQuoteDto.items.length > 0) {
        // Eliminar ítems existentes
        await prisma.quoteItem.deleteMany({
          where: { quoteId: id },
        });

        // Actualizar el presupuesto con los nuevos ítems (total recalculado)
        return prisma.quote.update({
          where: { id },
          data: {
            repairOrderId: updateQuoteDto.repairOrderId,
            customerId: updateQuoteDto.customerId,
            technicianId: updateQuoteDto.technicianId,
            status: updateQuoteDto.status,
            totalAmount: this.calculateTotal(updateQuoteDto.items),
            items: {
              create: updateQuoteDto.items.map((item) => ({
                quantity: item.quantity,
                price: toAmount(item.price),
                description: item.description,
              })),
            },
          },
          include: {
            items: true,
          },
        });
      }

      // Si no hay ítems nuevos, solo actualizar los datos básicos
      // (totalAmount no se toca: sigue siendo el calculado por el servidor)
      return prisma.quote.update({
        where: { id },
        data: {
          repairOrderId: updateQuoteDto.repairOrderId,
          customerId: updateQuoteDto.customerId,
          technicianId: updateQuoteDto.technicianId,
          status: updateQuoteDto.status,
        },
        include: {
          items: true,
        },
      });
    });

    // El cobro de la orden depende del total vigente: cualquier cambio de
    // estado o de ítems lo recalcula (recompute idempotente, sin duplicar).
    if (updateQuoteDto.status || updateQuoteDto.items?.length) {
      await this.repairOrders.recalcBilling(updatedQuote.repairOrderId);
    }

    return new QuoteResponseDto(updatedQuote);
  }

  /**
   * Actualiza el estado de un presupuesto validando la máquina de
   * transiciones (ALLOWED_TRANSITIONS). Las reversiones desde estados
   * finales solo las puede ejecutar un ADMIN.
   *
   * Al pasar a PAID el cambio se hace en una transacción que además:
   * - garantiza que la orden tenga como máximo un cobro vigente;
   * - recalcula el total de la orden (recalcBilling) y la cierra
   *   (COMPLETED + endDate, salvo que ya esté DELIVERED).
   *
   * @param id ID del presupuesto
   * @param status Nuevo estado
   * @param role Rol del usuario que ejecuta el cambio (para reversiones ADMIN)
   * @returns El presupuesto actualizado
   */
  async updateStatus(
    id: string,
    status: QuoteStatus,
    role: Role = Role.ADMIN,
  ): Promise<QuoteResponseDto> {
    // El body no pasa por ValidationPipe: validar el valor a mano
    if (!Object.values(QuoteStatus).includes(status)) {
      throw new BadRequestException(
        `Estado inválido: ${String(status)}. Valores permitidos: ${Object.values(QuoteStatus).join(', ')}`,
      );
    }

    const existing = await this.findOne(id);

    // Mismo estado: idempotente, no hace nada
    if (existing.status === status) {
      return existing;
    }

    this.assertTransition(existing.status, status, role);

    // Reflejo fuerte en la orden (solo al pagar)
    if (status === QuoteStatus.PAID) {
      return this.payQuote(existing);
    }

    const updatedQuote = await this.prisma.quote.update({
      where: { id },
      data: { status },
      include: {
        items: true,
      },
    });

    await this.repairOrders.recalcBilling(updatedQuote.repairOrderId);

    return new QuoteResponseDto(updatedQuote);
  }

  /**
   * Valida la transición de estado contra la máquina de transiciones.
   * @param current Estado actual
   * @param next Estado solicitado
   * @param role Rol del usuario (ADMIN puede revertir estados finales)
   */
  private assertTransition(
    current: QuoteStatus,
    next: QuoteStatus,
    role: Role,
  ): void {
    if (current === next) return;
    if (ALLOWED_TRANSITIONS[current]?.includes(next)) return;
    if (role === Role.ADMIN && ADMIN_REVERSALS[current]?.includes(next)) return;

    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    throw new ConflictException(
      `Transición de estado no permitida: ${current} → ${next}. ` +
        `Estados permitidos desde ${current}: ${allowed.length > 0 ? allowed.join(', ') : '(ninguno, estado final)'}`,
    );
  }

  /**
   * Registra el pago dentro de una transacción y lo refleja en la orden.
   * Solo llega aquí desde una transición APPROVED → PAID válida.
   */
  private async payQuote(quote: QuoteResponseDto): Promise<QuoteResponseDto> {
    return this.prisma.$transaction(async (prisma) => {
      // Regla de negocio: una orden solo admite un cobro vigente (un
      // presupuesto pagado o facturado); el resto se revierte primero.
      const otherCharged = await prisma.quote.count({
        where: {
          repairOrderId: quote.repairOrderId,
          status: { in: [QuoteStatus.PAID, QuoteStatus.INVOICED] },
          id: { not: quote.id },
        },
      });
      if (otherCharged > 0) {
        throw new ConflictException(
          'La orden ya tiene un presupuesto pagado o facturado; revierta ese cobro antes de pagar otro',
        );
      }

      const paid = await prisma.quote.update({
        where: { id: quote.id },
        data: { status: QuoteStatus.PAID },
        include: { items: true },
      });

      // recalcBilling (quote-to-cash) sincroniza el total vigente de la
      // orden con el presupuesto recién pagado...
      await this.repairOrders.recalcBilling(quote.repairOrderId, prisma);

      // ...y el pago además cierra la orden (si ya fue entregada, se respeta).
      const order = await prisma.repairOrder.findUnique({
        where: { id: quote.repairOrderId },
        select: { id: true, status: true, endDate: true },
      });
      if (order && order.status !== RepairOrderStatus.DELIVERED) {
        await prisma.repairOrder.update({
          where: { id: order.id },
          data: {
            status: RepairOrderStatus.COMPLETED,
            endDate: order.endDate ?? new Date(),
          },
        });
      }

      return new QuoteResponseDto(paid);
    });
  }

  /**
   * Elimina un presupuesto
   * @param id ID del presupuesto
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    const current = await this.findOne(id);

    // Los documentos cobrados (PAID/INVOICED) conservan la auditoría
    if (LOCKED_STATES.includes(current.status)) {
      throw new ConflictException(
        current.status === QuoteStatus.INVOICED
          ? 'Un presupuesto INVOICED no puede eliminarse porque ya generó una venta'
          : `El presupuesto en estado ${current.status} no puede eliminarse; revierta el estado primero`,
      );
    }

    await this.prisma.$transaction(async (prisma) => {
      // Eliminar los ítems del presupuesto
      await prisma.quoteItem.deleteMany({
        where: { quoteId: id },
      });

      // Eliminar el presupuesto
      await prisma.quote.delete({
        where: { id },
      });
    });

    // El borrado puede bajar el total vigente de la orden.
    await this.repairOrders.recalcBilling(current.repairOrderId);

    return { message: 'Presupuesto eliminado correctamente' };
  }
}
