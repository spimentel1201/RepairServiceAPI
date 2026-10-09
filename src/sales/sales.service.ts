import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleResponseDto, SaleItemResponseDto } from './dto/sale-response.dto';
import { SaleInvoiceDto, SaleInvoiceItemDto } from './dto/sale-invoice.dto';
import { Prisma } from '@prisma/client';
import { roundToTwoDecimals, toAmount } from '../common/utils/price.utils';
import { Paged } from '../common/pagination/pagination.utils';

export interface FindAllSalesParams {
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva venta
   *
   * El precio de cada ítem sale SIEMPRE del catálogo (`Product.price`); el valor
   * que envíe el cliente en `items[].price` se ignora. El total lo calcula el
   * servidor. La reserva de stock ocurre dentro de la transacción con un update
   * condicional, de modo que dos ventas simultáneas no pueden dejarlo negativo.
   *
   * @param createSaleDto Datos para crear la venta
   * @param userId ID del usuario que realiza la venta
   * @returns La venta creada
   */
  async create(
    createSaleDto: CreateSaleDto,
    userId: string,
  ): Promise<SaleResponseDto> {
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
        throw new NotFoundException(
          `Cliente con ID ${createSaleDto.customerId} no encontrado`,
        );
      }
    } else if (!createSaleDto.customerName) {
      // Si no hay customerId ni customerName, establecer un valor por defecto
      createSaleDto.customerName = 'Cliente no registrado';
    }

    // Verificar que los productos existen (precios de catalogo)
    const productIds = [
      ...new Set(createSaleDto.items.map((item) => item.productId)),
    ];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no existen');
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    // Total calculado por el servidor: precio de catalogo * cantidad
    let totalAmount = 0;
    for (const item of createSaleDto.items) {
      const product = productMap.get(item.productId);

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para el producto ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`,
        );
      }

      totalAmount += toAmount(product.price) * item.quantity;
    }
    totalAmount = roundToTwoDecimals(totalAmount);

    const sale = await this.prisma.$transaction(async (prisma) => {
      // Reserva de stock atomica: el `where` condicional se re-evalua con la
      // version mas reciente de la fila, por lo que si otra venta ya consumio
      // el stock disponible el count es 0 y la venta no se concreta.
      for (const item of createSaleDto.items) {
        const product = productMap.get(item.productId);

        const reserved = await prisma.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (reserved.count === 0) {
          throw new BadRequestException(
            `Stock insuficiente para el producto ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`,
          );
        }
      }

      // Crear la venta con los precios del catalogo
      return prisma.sale.create({
        data: {
          customerId: createSaleDto.customerId,
          customerName: createSaleDto.customerName,
          userId,
          totalAmount,
          paymentMethod: createSaleDto.paymentMethod,
          items: {
            create: createSaleDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: toAmount(productMap.get(item.productId).price),
            })),
          },
        },
        include: {
          items: true,
          user: true,
          customer: true,
        },
      });
    });

    // Preparar la respuesta
    const saleItems = sale.items.map((item) => {
      const product = productMap.get(item.productId);
      return new SaleItemResponseDto({
        ...item,
        productName: product.name,
        productDescription: product.description,
      });
    });

    return new SaleResponseDto({
      ...sale,
      items: saleItems,
      userName: `${sale.user.firstName} ${sale.user.lastName}`,
      customerFullName: sale.customer ? sale.customer.name : sale.customerName,
    });
  }

  /**
   * Obtiene una página de ventas
   * @param params Filtros opcionales (rango de fechas, cliente) y paginación
   * @returns Página de ventas y total de registros que cumplen el filtro
   */
  async findAll(
    params: FindAllSalesParams = {},
  ): Promise<Paged<SaleResponseDto>> {
    const where: Prisma.SaleWhereInput = {};

    if (params.startDate || params.endDate) {
      where.createdAt = {};

      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }

      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    if (params.customerId) {
      where.customerId = params.customerId;
    }

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: params.skip,
        take: params.take,
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
      }),
      this.prisma.sale.count({ where }),
    ]);

    const data = sales.map((sale) => {
      const saleItems = sale.items.map(
        (item) =>
          new SaleItemResponseDto({
            ...item,
            productName: item.product.name,
            productDescription: item.product.description,
          }),
      );

      return new SaleResponseDto({
        ...sale,
        items: saleItems,
        userName: `${sale.user.firstName} ${sale.user.lastName}`,
        customerFullName: sale.customer
          ? sale.customer.name
          : sale.customerName,
      });
    });

    return { data, total };
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

    const saleItems = sale.items.map(
      (item) =>
        new SaleItemResponseDto({
          ...item,
          productName: item.product.name,
          productDescription: item.product.description,
        }),
    );

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

    // Calcular subtotal y impuestos (18% IGV)
    const total = toAmount(sale.totalAmount);
    const subtotal = roundToTwoDecimals(total / 1.18);
    const tax = roundToTwoDecimals(total - subtotal);

    // Generar número de factura (formato: INV-YYYYMMDD-ID)
    const date = new Date(sale.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const invoiceNumber = `INV-${year}${month}${day}-${sale.id.substring(0, 8)}`;

    // Crear ítems de la factura
    const invoiceItems = sale.items.map(
      (item) =>
        new SaleInvoiceItemDto({
          productName: item.product.name,
          productDescription: item.product.description,
          quantity: item.quantity,
          unitPrice: toAmount(item.price),
          totalPrice: roundToTwoDecimals(toAmount(item.price) * item.quantity),
        }),
    );

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
      totalAmount: total,
      items: invoiceItems,
    });
  }

  /**
   * Actualiza una venta
   * @param id ID de la venta
   * @param updateSaleDto Datos para actualizar
   * @returns La venta actualizada
   */
  async update(
    id: string,
    updateSaleDto: UpdateSaleDto,
  ): Promise<SaleResponseDto> {
    // Verificar si la venta existe
    await this.findOne(id);

    // No permitimos actualizar los ítems de una venta ya realizada
    // Solo permitimos actualizar información básica como el cliente o método de pago
    if (updateSaleDto.items) {
      throw new BadRequestException(
        'No se pueden modificar los ítems de una venta ya realizada',
      );
    }

    // Verificar que el cliente existe si se proporciona un ID
    if (updateSaleDto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: updateSaleDto.customerId },
      });

      if (!customer) {
        throw new NotFoundException(
          `Cliente con ID ${updateSaleDto.customerId} no encontrado`,
        );
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

    const saleItems = updatedSale.items.map(
      (item) =>
        new SaleItemResponseDto({
          ...item,
          productName: item.product.name,
          productDescription: item.product.description,
        }),
    );

    return new SaleResponseDto({
      ...updatedSale,
      items: saleItems,
      userName: `${updatedSale.user.firstName} ${updatedSale.user.lastName}`,
      customerFullName: updatedSale.customer
        ? updatedSale.customer.name
        : updatedSale.customerName,
    });
  }

  /**
   * Elimina una venta
   * @param id ID de la venta
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verificar si la venta existe
    const sale = await this.findOne(id);

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
  }
}
