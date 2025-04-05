import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { QuoteStatus } from '@prisma/client';

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo presupuesto
   * @param createQuoteDto Datos para crear el presupuesto
   * @returns El presupuesto creado
   */
  async create(createQuoteDto: CreateQuoteDto): Promise<QuoteResponseDto> {
    // Verificar si la orden de reparación existe
    const repairOrder = await this.prisma.repairOrder.findUnique({
      where: { id: createQuoteDto.repairOrderId },
    });

    if (!repairOrder) {
      throw new NotFoundException(`Orden de reparación con ID ${createQuoteDto.repairOrderId} no encontrada`);
    }

    // Verificar si el cliente existe
    const customer = await this.prisma.customer.findUnique({
      where: { id: createQuoteDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${createQuoteDto.customerId} no encontrado`);
    }

    // Verificar si el técnico existe
    const technician = await this.prisma.user.findUnique({
      where: { id: createQuoteDto.technicianId },
    });

    if (!technician) {
      throw new NotFoundException(`Técnico con ID ${createQuoteDto.technicianId} no encontrado`);
    }

    try {
      // Crear el presupuesto con sus ítems en una transacción
      const quote = await this.prisma.$transaction(async (prisma) => {
        // Crear el presupuesto
        const newQuote = await prisma.quote.create({
          data: {
            repairOrderId: createQuoteDto.repairOrderId,
            customerId: createQuoteDto.customerId,
            technicianId: createQuoteDto.technicianId,
            status: createQuoteDto.status || QuoteStatus.PENDING,
            totalAmount: createQuoteDto.totalAmount,
            items: {
              create: createQuoteDto.items.map(item => ({
                quantity: item.quantity,
                price: item.price,
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

      return new QuoteResponseDto(quote);
    } catch (error) {
      throw new BadRequestException(`Error al crear el presupuesto: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los presupuestos
   * @returns Lista de presupuestos
   */
  async findAll(): Promise<QuoteResponseDto[]> {
    const quotes = await this.prisma.quote.findMany({
      include: {
        items: true,
      },
    });

    return quotes.map(quote => new QuoteResponseDto(quote));
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
      },
    });

    if (!quote) {
      throw new NotFoundException(`Presupuesto con ID ${id} no encontrado`);
    }

    return new QuoteResponseDto(quote);
  }

  /**
   * Obtiene todos los presupuestos de una orden de reparación
   * @param repairOrderId ID de la orden de reparación
   * @returns Lista de presupuestos de la orden
   */
  async findByRepairOrder(repairOrderId: string): Promise<QuoteResponseDto[]> {
    const repairOrder = await this.prisma.repairOrder.findUnique({
      where: { id: repairOrderId },
    });

    if (!repairOrder) {
      throw new NotFoundException(`Orden de reparación con ID ${repairOrderId} no encontrada`);
    }

    const quotes = await this.prisma.quote.findMany({
      where: { repairOrderId },
      include: {
        items: true,
      },
    });

    return quotes.map(quote => new QuoteResponseDto(quote));
  }

  /**
   * Obtiene todos los presupuestos de un cliente
   * @param customerId ID del cliente
   * @returns Lista de presupuestos del cliente
   */
  async findByCustomer(customerId: string): Promise<QuoteResponseDto[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${customerId} no encontrado`);
    }

    const quotes = await this.prisma.quote.findMany({
      where: { customerId },
      include: {
        items: true,
      },
    });

    return quotes.map(quote => new QuoteResponseDto(quote));
  }

  /**
   * Actualiza un presupuesto
   * @param id ID del presupuesto
   * @param updateQuoteDto Datos para actualizar
   * @returns El presupuesto actualizado
   */
  async update(id: string, updateQuoteDto: UpdateQuoteDto): Promise<QuoteResponseDto> {
    // Verificar si el presupuesto existe
    await this.findOne(id);

    // Verificar si la orden de reparación existe (si se proporciona)
    if (updateQuoteDto.repairOrderId) {
      const repairOrder = await this.prisma.repairOrder.findUnique({
        where: { id: updateQuoteDto.repairOrderId },
      });

      if (!repairOrder) {
        throw new NotFoundException(`Orden de reparación con ID ${updateQuoteDto.repairOrderId} no encontrada`);
      }
    }

    // Verificar si el cliente existe (si se proporciona)
    if (updateQuoteDto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: updateQuoteDto.customerId },
      });

      if (!customer) {
        throw new NotFoundException(`Cliente con ID ${updateQuoteDto.customerId} no encontrado`);
      }
    }

    // Verificar si el técnico existe (si se proporciona)
    if (updateQuoteDto.technicianId) {
      const technician = await this.prisma.user.findUnique({
        where: { id: updateQuoteDto.technicianId },
      });

      if (!technician) {
        throw new NotFoundException(`Técnico con ID ${updateQuoteDto.technicianId} no encontrado`);
      }
    }

    try {
      // Actualizar el presupuesto en una transacción
      const updatedQuote = await this.prisma.$transaction(async (prisma) => {
        // Si hay ítems nuevos, eliminar los existentes y crear los nuevos
        if (updateQuoteDto.items && updateQuoteDto.items.length > 0) {
          // Eliminar ítems existentes
          await prisma.quoteItem.deleteMany({
            where: { quoteId: id },
          });

          // Actualizar el presupuesto con los nuevos ítems
          const quote = await prisma.quote.update({
            where: { id },
            data: {
              repairOrderId: updateQuoteDto.repairOrderId,
              customerId: updateQuoteDto.customerId,
              technicianId: updateQuoteDto.technicianId,
              status: updateQuoteDto.status,
              totalAmount: updateQuoteDto.totalAmount,
              items: {
                create: updateQuoteDto.items.map(item => ({
                  quantity: item.quantity,
                  price: item.price,
                  description: item.description,
                })),
              },
            },
            include: {
              items: true,
            },
          });

          return quote;
        } else {
          // Si no hay ítems nuevos, solo actualizar los datos básicos
          const quote = await prisma.quote.update({
            where: { id },
            data: {
              repairOrderId: updateQuoteDto.repairOrderId,
              customerId: updateQuoteDto.customerId,
              technicianId: updateQuoteDto.technicianId,
              status: updateQuoteDto.status,
              totalAmount: updateQuoteDto.totalAmount,
            },
            include: {
              items: true,
            },
          });

          return quote;
        }
      });

      return new QuoteResponseDto(updatedQuote);
    } catch (error) {
      throw new BadRequestException(`Error al actualizar el presupuesto: ${error.message}`);
    }
  }

  /**
   * Actualiza el estado de un presupuesto
   * @param id ID del presupuesto
   * @param status Nuevo estado
   * @returns El presupuesto actualizado
   */
  async updateStatus(id: string, status: QuoteStatus): Promise<QuoteResponseDto> {
    // Verificar si el presupuesto existe
    await this.findOne(id);

    try {
      const updatedQuote = await this.prisma.quote.update({
        where: { id },
        data: { status },
        include: {
          items: true,
        },
      });

      return new QuoteResponseDto(updatedQuote);
    } catch (error) {
      throw new BadRequestException(`Error al actualizar el estado del presupuesto: ${error.message}`);
    }
  }

  /**
   * Elimina un presupuesto
   * @param id ID del presupuesto
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verificar si el presupuesto existe
    await this.findOne(id);

    try {
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

      return { message: 'Presupuesto eliminado correctamente' };
    } catch (error) {
      throw new BadRequestException(`Error al eliminar el presupuesto: ${error.message}`);
    }
  }
}