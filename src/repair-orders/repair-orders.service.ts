import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { RepairOrderResponseDto } from './dto/repair-order-response.dto';
import { RepairOrderStatus } from '@prisma/client';

/**
 * Servicio para gestionar órdenes de reparación
 */
@Injectable()
export class RepairOrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva orden de reparación
   * @param createRepairOrderDto Datos para crear la orden
   * @returns La orden creada
   */
  async create(createRepairOrderDto: CreateRepairOrderDto): Promise<RepairOrderResponseDto> {
    // Verificar si el cliente existe
    /*
    if (!createRepairOrderDto.customerId){
      try{
        const customer = await this.prisma.customer.create({
          data: {
            name: createRepairOrderDto.customerName,
            email: createRepairOrderDto.customerEmail,
            phone: createRepairOrderDto.customerPhone,
            documentNumber: createRepairOrderDto.customerDocument,
            documentType: createRepairOrderDto.customerDocumentType,
            address: createRepairOrderDto.customerAddress,
          },
        });
        createRepairOrderDto.customerId = customer.id;
      }catch(error){
        throw new BadRequestException(`Error al crear el cliente: ${error.message}`);
      }
    }
    */
    const customer = await this.prisma.customer.findUnique({
      where: { id: createRepairOrderDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${createRepairOrderDto.customerId} no encontrado`);
    }
    /*
    // Verificar si el técnico existe
    const technician = await this.prisma.user.findUnique({
      where: { id: createRepairOrderDto.technicianId },
    });

    
    if (!technician) {
      throw new NotFoundException(`Técnico con ID ${createRepairOrderDto.technicianId} no encontrado`);
    }
    */
    // Calcular el monto total de la orden
    const totalAmount = createRepairOrderDto.items.reduce(
      (sum, item) => sum + (item.price || 0) * item.quantity,
      0
    );

    try {
  const repairOrder = await this.prisma.$transaction(async (prisma) => {
    const order = await prisma.repairOrder.create({
      data: {
        customerId: createRepairOrderDto.customerId || null,
        technicianId: createRepairOrderDto.technicianId || null,
        status: createRepairOrderDto.status || RepairOrderStatus.RECEIVED,
        description: createRepairOrderDto.description,
        notes: createRepairOrderDto.notes,
        initialReviewCost: createRepairOrderDto.initialReviewCost || 0,
        totalCost: (createRepairOrderDto.initialReviewCost || 0) + totalAmount,
        items: {
          create: createRepairOrderDto.items.map(item => ({
            deviceType: item.deviceType,
            brand: item.brand,
            model: item.model,
            serialNumber: item.serialNumber,
            problemDescription: item.problemDescription,
            accessories: item.accessories || [],
            quantity: item.quantity,
            price: item.price || 0,
            productId: item.productId,
          })),
        },
      },
      include: {
        items: true,
      },
    });
      return order;
    });
      return new RepairOrderResponseDto(repairOrder);
    } catch (error) {
      throw new BadRequestException(`Error al crear la orden de reparación: ${error.message}`);
    }
  }

  /**
   * Obtiene todas las órdenes de reparación
   * @returns Lista de órdenes
   */
  async findAll(): Promise<RepairOrderResponseDto[]> {
    const repairOrders = await this.prisma.repairOrder.findMany({
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
      },
    });
    return repairOrders.map(order => new RepairOrderResponseDto(order));
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
          }
        },
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
      },
    });

    if (!repairOrder) {
      throw new NotFoundException(`Orden de reparación con ID ${id} no encontrada`);
    }

    return new RepairOrderResponseDto(repairOrder);
  }

  /**
   * Obtiene todas las órdenes de un cliente
   * @param customerId ID del cliente
   * @returns Lista de órdenes del cliente
   */
  async findByCustomer(customerId: string): Promise<RepairOrderResponseDto[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${customerId} no encontrado`);
    }

    const repairOrders = await this.prisma.repairOrder.findMany({
      where: { customerId },
      include: {
        items: true,
      },
    });

    return repairOrders.map(order => new RepairOrderResponseDto(order));
  }

  /**
   * Obtiene todas las órdenes asignadas a un técnico
   * @param technicianId ID del técnico
   * @returns Lista de órdenes del técnico
   */
  async findByTechnician(technicianId: string): Promise<RepairOrderResponseDto[]> {
    const technician = await this.prisma.user.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new NotFoundException(`Técnico con ID ${technicianId} no encontrado`);
    }

    const repairOrders = await this.prisma.repairOrder.findMany({
      where: { technicianId },
      include: {
        items: true,
      },
    });

    return repairOrders.map(order => new RepairOrderResponseDto(order));
  }

  /**
   * Actualiza una orden de reparación
   * @param id ID de la orden
   * @param updateRepairOrderDto Datos para actualizar
   * @returns La orden actualizada
   */
  async update(id: string, updateRepairOrderDto: UpdateRepairOrderDto): Promise<RepairOrderResponseDto> {
    // Verificar si la orden existe
    await this.findOne(id);

    // Verificar si el cliente existe (si se proporciona)
    if (updateRepairOrderDto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: updateRepairOrderDto.customerId },
      });

      if (!customer) {
        throw new NotFoundException(`Cliente con ID ${updateRepairOrderDto.customerId} no encontrado`);
      }
    }

    // Verificar si el técnico existe (si se proporciona)
    if (updateRepairOrderDto.technicianId) {
      const technician = await this.prisma.user.findUnique({
        where: { id: updateRepairOrderDto.technicianId },
      });

      if (!technician) {
        throw new NotFoundException(`Técnico con ID ${updateRepairOrderDto.technicianId} no encontrado`);
      }
    }

    try {
      // Actualizar la orden en una transacción
      const updatedOrder = await this.prisma.$transaction(async (prisma) => {
        // Si hay items nuevos, eliminar los existentes y crear los nuevos
        if (updateRepairOrderDto.items && updateRepairOrderDto.items.length > 0) {
          // Eliminar items existentes
          await prisma.repairOrderItem.deleteMany({
            where: { repairOrderId: id },
          });

          // Calcular el nuevo monto total
          const totalAmount = updateRepairOrderDto.items.reduce(
            (sum, item) => sum + (item.price || 0) * item.quantity,
            0
          );

          // Actualizar la orden con los nuevos items
          const order = await prisma.repairOrder.update({
            where: { id },
            data: {
              customerId: updateRepairOrderDto.customerId,
              technicianId: updateRepairOrderDto.technicianId,
              status: updateRepairOrderDto.status,
              description: updateRepairOrderDto.description,
              notes: updateRepairOrderDto.notes,
              totalCost: totalAmount,
              // Si el estado cambia a COMPLETED, establecer la fecha de finalización
              endDate: updateRepairOrderDto.status === RepairOrderStatus.COMPLETED 
                ? new Date() 
                : undefined,
              items: {
                create: updateRepairOrderDto.items.map(item => ({
                  deviceType: item.deviceType,
                  brand: item.brand,
                  model: item.model,
                  serialNumber: item.serialNumber,
                  problemDescription: item.problemDescription,
                  accessories: item.accessories || [],
                  quantity: item.quantity,
                  price: item.price || 0,
                  productId: item.productId,
                })),
              },
            },
            include: {
              items: true,
            },
          });

          return order;
        } else {
          // Si no hay items nuevos, solo actualizar los datos básicos
          const order = await prisma.repairOrder.update({
            where: { id },
            data: {
              customerId: updateRepairOrderDto.customerId,
              technicianId: updateRepairOrderDto.technicianId,
              status: updateRepairOrderDto.status,
              notes: updateRepairOrderDto.notes,
              // Si el estado cambia a COMPLETED, establecer la fecha de finalización
              endDate: updateRepairOrderDto.status === RepairOrderStatus.COMPLETED 
                ? new Date() 
                : undefined,
            },
            include: {
              items: true,
            },
          });

          return order;
        }
      });

      return new RepairOrderResponseDto(updatedOrder);
    } catch (error) {
      throw new BadRequestException(`Error al actualizar la orden de reparación: ${error.message}`);
    }
  }

  /**
   * Elimina una orden de reparación
   * @param id ID de la orden
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verificar si la orden existe
    await this.findOne(id);

    try {
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
    } catch (error) {
      throw new BadRequestException(`Error al eliminar la orden de reparación: ${error.message}`);
    }
  }

  /**
   * Actualiza el estado de una orden
   * @param id ID de la orden
   * @param status Nuevo estado
   * @returns La orden actualizada
   */
  async updateStatus(id: string, status: RepairOrderStatus): Promise<RepairOrderResponseDto> {
    // Verificar si la orden existe
    await this.findOne(id);

    try {
      const updatedOrder = await this.prisma.repairOrder.update({
        where: { id },
        data: {
          status,
          // Si el estado cambia a COMPLETED, establecer la fecha de finalización
          endDate: status === RepairOrderStatus.COMPLETED ? new Date() : undefined,
        },
        include: {
          items: true,
        },
      });

      return new RepairOrderResponseDto(updatedOrder);
    } catch (error) {
      throw new BadRequestException(`Error al actualizar el estado de la orden de reparación: ${error.message}`);
    }
  }
}