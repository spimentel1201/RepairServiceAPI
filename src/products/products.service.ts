import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo producto
   * @param createProductDto Datos para crear el producto
   * @returns El producto creado
   */
  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    try {
      // Verificar si ya existe un producto con el mismo nombre
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          name: createProductDto.name,
        },
      });

      if (existingProduct) {
        throw new ConflictException(`Ya existe un producto con el nombre ${createProductDto.name}`);
      }

      // Crear el producto con los campos adicionales
      const product = await this.prisma.product.create({
        data: {
          name: createProductDto.name,
          description: createProductDto.description,
          price: createProductDto.price,
          cost: createProductDto.cost,
          stock: createProductDto.stock,
          category: createProductDto.category,
          isActive: createProductDto.isActive ?? true,
          // Campos adicionales que no están en el schema pero que podemos guardar en la descripción
          // o en una tabla adicional en el futuro
          // Por ahora, los guardamos como metadatos en la descripción
          ...(createProductDto.imageUrl && { imageUrl: createProductDto.imageUrl }),
        },
      });

      return new ProductResponseDto({
        ...product,
        imageUrl: createProductDto.imageUrl,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Error al crear el producto: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los productos
   * @param category Filtro opcional por categoría
   * @param active Filtro opcional por estado activo/inactivo
   * @returns Lista de productos
   */
  async findAll(category?: string, active?: boolean): Promise<ProductResponseDto[]> {
    const where: Prisma.ProductWhereInput = {};
    
    if (category) {
      where.category = category;
    }
    
    if (active !== undefined) {
      where.isActive = active;
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return products.map(product => {
      // Extraer metadatos de la descripción si existen
      const metadata = this.extractMetadata(product.description);
      
      return new ProductResponseDto({
        ...product,
        ...metadata,
      });
    });
  }

  /**
   * Busca productos por nombre, descripción o categoría
   * @param query Término de búsqueda
   * @returns Lista de productos que coinciden con la búsqueda
   */
  async search(query: string): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });

    return products.map(product => {
      const metadata = this.extractMetadata(product.description);
      
      return new ProductResponseDto({
        ...product,
        ...metadata,
      });
    });
  }

  /**
   * Obtiene un producto por su ID
   * @param id ID del producto
   * @returns El producto encontrado
   */
  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    const metadata = this.extractMetadata(product.description);
    
    return new ProductResponseDto({
      ...product,
      ...metadata,
    });
  }

  /**
   * Obtiene todas las categorías de productos
   * @returns Lista de categorías únicas
   */
  async getCategories(): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
    });

    return products.map(product => product.category);
  }

  /**
   * Actualiza un producto
   * @param id ID del producto
   * @param updateProductDto Datos para actualizar
   * @returns El producto actualizado
   */
  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductResponseDto> {
    // Verificar si el producto existe
    await this.findOne(id);

    try {
      // Si se está actualizando el nombre, verificar que no exista otro producto con ese nombre
      if (updateProductDto.name) {
        const existingProduct = await this.prisma.product.findFirst({
          where: {
            name: updateProductDto.name,
            id: { not: id },
          },
        });

        if (existingProduct) {
          throw new ConflictException(`Ya existe otro producto con el nombre ${updateProductDto.name}`);
        }
      }

      // Actualizar el producto con los campos adicionales
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          name: updateProductDto.name,
          description: updateProductDto.description,
          price: updateProductDto.price,
          cost: updateProductDto.cost,
          stock: updateProductDto.stock,
          category: updateProductDto.category,
          isActive: updateProductDto.isActive,
          // Campos adicionales que no están en el schema pero que podemos guardar en la descripción
          // o en una tabla adicional en el futuro
          ...(updateProductDto.imageUrl && { imageUrl: updateProductDto.imageUrl }),
        },
      });

      return new ProductResponseDto({
        ...product,
        imageUrl: updateProductDto.imageUrl,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar el producto: ${error.message}`);
    }
  }

  /**
   * Actualiza el stock de un producto
   * @param id ID del producto
   * @param quantity Cantidad a añadir (positiva) o restar (negativa)
   * @returns El producto actualizado
   */
  async updateStock(id: string, quantity: number): Promise<ProductResponseDto> {
    const product = await this.findOne(id);

    // Verificar que el stock no quede negativo
    if (product.stock + quantity < 0) {
      throw new BadRequestException(`No hay suficiente stock disponible. Stock actual: ${product.stock}`);
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        stock: {
          increment: quantity,
        },
      },
    });

    const metadata = this.extractMetadata(updatedProduct.description);
    
    return new ProductResponseDto({
      ...updatedProduct,
      ...metadata,
    });
  }

  /**
   * Elimina un producto
   * @param id ID del producto
   * @returns Mensaje de confirmación
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verificar si el producto existe
    await this.findOne(id);

    try {
      // Verificar si el producto está siendo utilizado en órdenes de reparación o ventas
      const productWithRelations = await this.prisma.product.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              repairOrderItems: true,
              saleItems: true,
            },
          },
        },
      });

      if (
        productWithRelations._count.repairOrderItems > 0 ||
        productWithRelations._count.saleItems > 0
      ) {
        // En lugar de impedir la eliminación, marcamos el producto como inactivo
        await this.prisma.product.update({
          where: { id },
          data: {
            isActive: false,
          },
        });

        return { message: 'Producto marcado como inactivo porque tiene relaciones con órdenes o ventas' };
      }

      // Si no tiene relaciones, eliminamos el producto
      await this.prisma.product.delete({
        where: { id },
      });

      return { message: 'Producto eliminado correctamente' };
    } catch (error) {
      throw new BadRequestException(`Error al eliminar el producto: ${error.message}`);
    }
  }

  /**
   * Extrae metadatos de la descripción del producto
   * @param description Descripción del producto
   * @returns Objeto con los metadatos extraídos
   */
  private extractMetadata(description?: string): { imageUrl?: string; brand?: string; model?: string } {
    if (!description) {
      return {};
    }

    const metadata: { imageUrl?: string; brand?: string; model?: string } = {};
    
    // Aquí podríamos implementar lógica para extraer metadatos de la descripción
    // Por ahora, retornamos un objeto vacío
    
    return metadata;
  }
}