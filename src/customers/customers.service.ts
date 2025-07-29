import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { CustomerHistoryDto } from './dto/customer-history.dto';
import { Prisma } from '@prisma/client';
import { RepairOrderItemResponseDto, RepairOrderResponseDto } from 'src/repair-orders/dto/repair-order-response.dto';
import { QuoteItemResponseDto, QuoteResponseDto } from 'src/quotes/dto/quote-response.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo cliente
   * @param createCustomerDto Datos para crear el cliente
   * @returns El cliente creado
   */
  async create(createCustomerDto: CreateCustomerDto): Promise<CustomerResponseDto> {
    try {
      const customer = await this.prisma.customer.create({
        data: createCustomerDto,
      });

      return new CustomerResponseDto(customer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Error de clave única (P2002)
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          if (target?.includes('email')) {
            throw new ConflictException('El correo electrónico ya está registrado');
          }
          if (target?.includes('documentNumber')) {
            throw new ConflictException('El número de documento ya está registrado');
          }
        }
      }
      throw new BadRequestException(`Error al crear el cliente: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los clientes
   * @returns Lista de clientes
   */
  async findAll(): Promise<CustomerResponseDto[]> {
    const customers = await this.prisma.customer.findMany();
    return customers.map(customer => new CustomerResponseDto(customer));
  }

  /**
   * Busca clientes por nombre, email, teléfono o número de documento
   * @param query Término de búsqueda
   * @returns Lista de clientes que coinciden con la búsqueda
   */
  async search(query: string): Promise<CustomerResponseDto[]> {
    const customers = await this.prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { documentNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
    });

    return customers.map(customer => new CustomerResponseDto(customer));
  }

  /**
   * Obtiene un cliente por su ID
   * @param id ID del cliente
   * @returns El cliente encontrado
   */
  async findOne(id: string): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return new CustomerResponseDto(customer);
  }

  /**
   * Obtiene el historial de un cliente (órdenes de reparación y presupuestos)
   * @param id ID del cliente
   * @returns Historial del cliente
   */
  async getHistory(id: string): Promise<CustomerHistoryDto> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        repairOrders: {
          include: {
            items: true,
            technician: true,
          },
        },
        quotes: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    // Transformar repairOrders a RepairOrderResponseDto
    const repairOrders = customer.repairOrders.map(order => 
      new RepairOrderResponseDto({
        ...order,
        customerName: customer.name,
        technicianName: order.technician?.firstName + ' ' + order.technician?.lastName || '', // Asumiendo que technician tiene una propiedad name
        technicianId: order.technician?.id || '', // Asumiendo que technician tiene una propiedad id
        items: order.items.map(item => new RepairOrderItemResponseDto(item))
      })
    );

    // Transformar quotes a QuoteResponseDto si es necesario
    const quotes = customer.quotes.map(quote => 
      new QuoteResponseDto({
        ...quote,
        items: quote.items.map(item => new QuoteItemResponseDto(item))
      })
    );

    return new CustomerHistoryDto({
      customerId: customer.id,
      customerName: customer.name,
      repairOrders,
      quotes,
    });
  }

  /**
   * Actualiza un cliente
   * @param id ID del cliente
   * @param updateCustomerDto Datos para actualizar
   * @returns El cliente actualizado
   */
  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<CustomerResponseDto> {
    // Verificar si el cliente existe
    await this.findOne(id);

    try {
      const updatedCustomer = await this.prisma.customer.update({
        where: { id },
        data: updateCustomerDto,
      });

      return new CustomerResponseDto(updatedCustomer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Error de clave única (P2002)
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          if (target?.includes('email')) {
            throw new ConflictException('El correo electrónico ya está registrado');
          }
          if (target?.includes('documentNumber')) {
            throw new ConflictException('El número de documento ya está registrado');
          }
        }
      }
      throw new BadRequestException(`Error al actualizar el cliente: ${error.message}`);
    }
  }

  /**
   * Elimina un cliente
   * @param id ID del cliente
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verificar si el cliente existe
    await this.findOne(id);

    try {
      // Verificar si el cliente tiene órdenes de reparación o presupuestos
      const customerWithRelations = await this.prisma.customer.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              repairOrders: true,
              quotes: true,
              sales: true,
            },
          },
        },
      });

      if (
        customerWithRelations._count.repairOrders > 0 ||
        customerWithRelations._count.quotes > 0 ||
        customerWithRelations._count.sales > 0
      ) {
        throw new BadRequestException(
          'No se puede eliminar el cliente porque tiene órdenes de reparación, presupuestos o ventas asociadas',
        );
      }

      await this.prisma.customer.delete({
        where: { id },
      });

      return { message: 'Cliente eliminado correctamente' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al eliminar el cliente: ${error.message}`);
    }
  }

  /**
   * Envía una notificación al cliente sobre el estado de su orden de reparación
   * @param customerId ID del cliente
   * @param repairOrderId ID de la orden de reparación
   * @param message Mensaje de la notificación
   * @returns Mensaje de confirmación
   */
  async sendNotification(
    customerId: string,
    repairOrderId: string,
    message: string,
  ): Promise<{ message: string }> {
    // Verificar si el cliente existe
    const customer = await this.findOne(customerId);

    // Verificar si la orden de reparación existe y pertenece al cliente
    const repairOrder = await this.prisma.repairOrder.findFirst({
      where: {
        id: repairOrderId,
        customerId,
      },
    });

    if (!repairOrder) {
      throw new NotFoundException(
        `Orden de reparación con ID ${repairOrderId} no encontrada para el cliente con ID ${customerId}`,
      );
    }

    // Aquí iría la lógica para enviar la notificación (email, SMS, etc.)
    // Por ahora solo retornamos un mensaje de éxito
    console.log(`Notificación enviada a ${customer.name} (${customer.email || customer.phone}): ${message}`);

    return { message: 'Notificación enviada correctamente' };
  }
}