import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleResponseDto, SaleItemResponseDto } from './dto/sale-response.dto';
import { SaleInvoiceDto, SaleInvoiceItemDto } from './dto/sale-invoice.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva venta
   * @param createSaleDto Datos para crear la venta
   * @param userId ID del usuario que realiza la venta
   * @returns La venta creada
   */
  async create(createSaleDto: CreateSaleDto, userId: string): Promise<SaleResponseDto> {
    try {
      // Verificar que al menos hay un ítem en la venta
      if (!createSaleDto.items || createSaleDto.items.length === 0) {
        throw new BadRequestException('La venta debe tener al menos un ítem');
      }

      // Verificar que el cliente existe si se proporciona un ID
      if (createSaleDto.customerId) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: createSaleDto.customerId },
        });

        if (!customer) {
          throw new NotFoundException(`Cliente con ID ${createSaleDto.customerId} no encontrado`);
        }
      } else if (!createSaleDto.customerName) {
        // Si no hay customerId ni customerName, establecer un valor por defecto
        createSaleDto.customerName = 'Cliente no registrado';
      }

      // Verificar que los productos existen y tienen suficiente stock
      const productIds = createSaleDto.items.map(item => item.productId);
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      if (products.length !== productIds.length) {
        throw new BadRequestException('Uno o más productos no existen');
      }

      // Verificar stock y calcular el total
      let totalAmount = 0;
      const productMap = new Map(products.map(product => [product.id, product]));
      
      for (const item of createSaleDto.items) {
        const product = productMap.get(item.productId);
        
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para el producto ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`
          );
        }
        
        // Usar el precio del producto si no se proporciona uno específico
        if (!item.price) {
          item.price = product.price;
        }
        
        totalAmount += item.price * item.quantity;
      }

      // Crear la venta y sus ítems en una transacción
      const sale = await this.prisma.$transaction(async (prisma) => {
        // Crear la venta
        const newSale = await prisma.sale.create({
          data: {
            customerId: createSaleDto.customerId,
            customerName: createSaleDto.customerName,
            userId,
            totalAmount,
            paymentMethod: createSaleDto.paymentMethod,
            items: {
              create: createSaleDto.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          },
          include: {
            items: true,
            user: true,
            customer: true,
          },
        });

        // Actualizar el stock de los productos
        for (const item of createSaleDto.items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        }

        return newSale;
      });

      // Preparar la respuesta
      const saleItems = await Promise.all(
        sale.items.map(async (item) => {
          const product = productMap.get(item.productId);
          
          return new SaleItemResponseDto({
            ...item,
            productName: product.name,
            productDescription: product.description,
          });
        })
      );

      return new SaleResponseDto({
        ...sale,
        items: saleItems,
        userName: `${sale.user.firstName} ${sale.user.lastName}`,
        customerFullName: sale.customer ? sale.customer.name : sale.customerName,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al crear la venta: ${error.message}`);
    }
  }

  /**
   * Obtiene todas las ventas
   * @param startDate Fecha de inicio para filtrar
   * @param endDate Fecha de fin para filtrar
   * @param customerId ID del cliente para filtrar
   * @returns Lista de ventas
   */
  async findAll(startDate?: Date, endDate?: Date, customerId?: string): Promise<SaleResponseDto[]> {
    const where: Prisma.SaleWhereInput = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }
    
    if (customerId) {
      where.customerId = customerId;
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sales.map(sale => {
      const saleItems = sale.items.map(item => new SaleItemResponseDto({
        ...item,
        productName: item.product.name,
        productDescription: item.product.description,
      }));

      return new SaleResponseDto({
        ...sale,
        items: saleItems,
        userName: `${sale.user.firstName} ${sale.user.lastName}`,
        customerFullName: sale.customer ? sale.customer.name : sale.customerName,
      });
    });
  }

  /**
   * Obtiene una venta por su ID
   * @param id ID de la venta
   * @returns La venta encontrada
   */
  async findOne(id: string): Promise<SaleResponseDto> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
        customer: true,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }

    const saleItems = sale.items.map(item => new SaleItemResponseDto({
      ...item,
      productName: item.product.name,
      productDescription: item.product.description,
    }));

    return new SaleResponseDto({
      ...sale,
      items: saleItems,
      userName: `${sale.user.firstName} ${sale.user.lastName}`,
      customerFullName: sale.customer ? sale.customer.name : sale.customerName,
    });
  }

  /**
   * Genera una factura o ticket para una venta
   * @param id ID de la venta
   * @returns La factura o ticket generado
   */
  async generateInvoice(id: string): Promise<SaleInvoiceDto> {
    // Instead of using findOne which returns SaleResponseDto, we'll get the raw sale data
    const saleId = id;
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
        customer: true,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }
    
    // Calcular subtotal y impuestos (18% IGV)
    const subtotal = sale.totalAmount / 1.18;
    const tax = sale.totalAmount - subtotal;
    
    // Generar número de factura (formato: INV-YYYYMMDD-ID)
    const date = new Date(sale.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const invoiceNumber = `INV-${year}${month}${day}-${sale.id.substring(0, 8)}`;
    
    // Crear ítems de la factura
    const invoiceItems = sale.items.map(item => new SaleInvoiceItemDto({
      productName: item.product.name,
      productDescription: item.product.description,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));
    
    // Crear la factura
    return new SaleInvoiceDto({
      invoiceNumber,
      date: sale.createdAt,
      customerName: sale.customer ? sale.customer.name : sale.customerName,
      customerDocument: sale.customer?.documentNumber,
      sellerName: `${sale.user.firstName} ${sale.user.lastName}`,
      paymentMethod: sale.paymentMethod,
      subtotal,
      tax,
      totalAmount: sale.totalAmount,
      items: invoiceItems,
    });
  }

  /**
   * Actualiza una venta
   * @param id ID de la venta
   * @param updateSaleDto Datos para actualizar
   * @returns La venta actualizada
   */
  async update(id: string, updateSaleDto: UpdateSaleDto): Promise<SaleResponseDto> {
    // Verificar si la venta existe
    await this.findOne(id);
    
    // No permitimos actualizar los ítems de una venta ya realizada
    // Solo permitimos actualizar información básica como el cliente o método de pago
    if (updateSaleDto.items) {
      throw new BadRequestException('No se pueden modificar los ítems de una venta ya realizada');
    }
    
    try {
      // Verificar que el cliente existe si se proporciona un ID
      if (updateSaleDto.customerId) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: updateSaleDto.customerId },
        });

        if (!customer) {
          throw new NotFoundException(`Cliente con ID ${updateSaleDto.customerId} no encontrado`);
        }
      }
      
      // Actualizar la venta
      const updatedSale = await this.prisma.sale.update({
        where: { id },
        data: {
          customerId: updateSaleDto.customerId,
          customerName: updateSaleDto.customerName,
          paymentMethod: updateSaleDto.paymentMethod,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          user: true,
          customer: true,
        },
      });
      
      const saleItems = updatedSale.items.map(item => new SaleItemResponseDto({
        ...item,
        productName: item.product.name,
        productDescription: item.product.description,
      }));

      return new SaleResponseDto({
        ...updatedSale,
        items: saleItems,
        userName: `${updatedSale.user.firstName} ${updatedSale.user.lastName}`,
        customerFullName: updatedSale.customer ? updatedSale.customer.name : updatedSale.customerName,
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar la venta: ${error.message}`);
    }
  }

  /**
   * Elimina una venta
   * @param id ID de la venta
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verificar si la venta existe
    const sale = await this.findOne(id);
    
    try {
      // Eliminar la venta y restaurar el stock en una transacción
      await this.prisma.$transaction(async (prisma) => {
        // Restaurar el stock de los productos
        for (const item of sale.items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
        
        // Eliminar los ítems de la venta
        await prisma.saleItem.deleteMany({
          where: { saleId: id },
        });
        
        // Eliminar la venta
        await prisma.sale.delete({
          where: { id },
        });
      });
      
      return { message: 'Venta eliminada correctamente' };
    } catch (error) {
      throw new BadRequestException(`Error al eliminar la venta: ${error.message}`);
    }
  }
}