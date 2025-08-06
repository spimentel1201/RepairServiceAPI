import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { Prisma } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as csvParser from 'csv-parser';
import { Readable } from 'stream';
import { ImportFileType } from './dto/import-products.dto';
// Importar correctamente los tipos de Multer
import { Response } from 'express';
import * as Multer from 'multer';

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

  /**
   * Importa productos desde un archivo Excel o CSV
   * @param file Archivo a importar
   * @param fileType Tipo de archivo (excel o csv)
   * @returns Resultado de la importación
   */
  async importProducts(file: any, fileType: ImportFileType) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }
    
    let products = [];
    const errors = [];
    
    try {
      // Procesar el archivo según su tipo
      if (fileType === ImportFileType.EXCEL) {
        products = await this.parseExcelFile(file);
      } else if (fileType === ImportFileType.CSV) {
        products = await this.parseCsvFile(file);
      } else {
        throw new BadRequestException('Tipo de archivo no soportado');
      }
      
      // Validar y guardar los productos
      const importResults = await this.saveImportedProducts(products);
      
      return {
        message: `Se importaron ${importResults.successCount} productos correctamente`,
        importedCount: importResults.successCount,
        errors: importResults.errors
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al procesar el archivo: ${error.message}`);
    }
  }
  
  /**
   * Procesa un archivo Excel y extrae los productos
   * @param file Archivo Excel
   * @returns Array de productos
   */
  private async parseExcelFile(file: Express.Multer.File): Promise<any[]> {
    try {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      return this.mapFileDataToProducts(data);
    } catch (error) {
      throw new BadRequestException(`Error al procesar el archivo Excel: ${error.message}`);
    }
  }
  
  /**
   * Procesa un archivo CSV y extrae los productos
   * @param file Archivo CSV
   * @returns Array de productos
   */
  private async parseCsvFile(file: Express.Multer.File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from(file.buffer);
      
      stream
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          try {
            const products = this.mapFileDataToProducts(results);
            resolve(products);
          } catch (error) {
            reject(new BadRequestException(`Error al procesar el archivo CSV: ${error.message}`));
          }
        })
        .on('error', (error) => {
          reject(new BadRequestException(`Error al leer el archivo CSV: ${error.message}`));
        });
    });
  }
  
  /**
   * Mapea los datos del archivo a objetos de producto
   * @param data Datos del archivo
   * @returns Array de productos mapeados
   */
  private mapFileDataToProducts(data: any[]): any[] {
    if (!data || data.length === 0) {
      throw new BadRequestException('El archivo no contiene datos');
    }
    
    // Validar que las columnas requeridas estén presentes
    const requiredColumns = ['name', 'price', 'cost', 'stock', 'category'];
    const firstRow = data[0];
    
    const missingColumns = requiredColumns.filter(col => {
      // Comprobar si la columna existe (considerando posibles variaciones en mayúsculas/minúsculas)
      return !Object.keys(firstRow).some(key => 
        key.toLowerCase() === col.toLowerCase() || 
        key.toLowerCase().replace(/\s+/g, '') === col.toLowerCase()
      );
    });
    
    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Faltan columnas requeridas en el archivo: ${missingColumns.join(', ')}. ` +
        `Las columnas requeridas son: ${requiredColumns.join(', ')}`
      );
    }
    
    // Mapear los datos a objetos de producto
    return data.map(row => {
      // Normalizar nombres de columnas (eliminar espacios, convertir a minúsculas)
      const normalizedRow = {};
      Object.keys(row).forEach(key => {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
        normalizedRow[normalizedKey] = row[key];
      });
      
      // Mapear a la estructura de CreateProductDto
      return {
        name: this.getValueFromRow(normalizedRow, 'name'),
        description: this.getValueFromRow(normalizedRow, 'description', ''),
        price: parseFloat(this.getValueFromRow(normalizedRow, 'price', 0)),
        cost: parseFloat(this.getValueFromRow(normalizedRow, 'cost', 0)),
        stock: parseInt(this.getValueFromRow(normalizedRow, 'stock', 0), 10),
        category: this.getValueFromRow(normalizedRow, 'category'),
        isActive: this.getValueFromRow(normalizedRow, 'isactive', true),
        imageUrl: this.getValueFromRow(normalizedRow, 'imageurl', null),
      };
    });
  }
  
  /**
   * Obtiene un valor de una fila, buscando por diferentes variaciones del nombre de la columna
   * @param row Fila de datos
   * @param key Nombre de la columna
   * @param defaultValue Valor por defecto
   * @returns Valor encontrado o valor por defecto
   */
  private getValueFromRow(row: any, key: string, defaultValue: any = null): any {
    // Buscar el valor en diferentes variaciones del nombre de la columna
    const variations = [
      key,
      key.toLowerCase(),
      key.toUpperCase(),
      key.charAt(0).toUpperCase() + key.slice(1),
    ];
    
    for (const variation of variations) {
      if (row[variation] !== undefined) {
        return row[variation];
      }
    }
    
    return defaultValue;
  }
  
  /**
   * Guarda los productos importados en la base de datos
   * @param products Productos a guardar
   * @returns Resultado de la operación
   */
  private async saveImportedProducts(products: any[]) {
    const errors = [];
    let successCount = 0;
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        // Validar datos del producto
        this.validateProductData(product, i);
        
        // Verificar si ya existe un producto con el mismo nombre
        const existingProduct = await this.prisma.product.findFirst({
          where: { name: product.name }
        });
        
        if (existingProduct) {
          errors.push({
            row: i + 2, // +2 porque la primera fila es el encabezado y los índices empiezan en 0
            error: `Ya existe un producto con el nombre '${product.name}'`
          });
          continue;
        }
        
        // Crear el producto
        await this.prisma.product.create({
          data: {
            name: product.name,
            description: product.description || '',
            price: product.price,
            cost: product.cost,
            stock: product.stock,
            category: product.category,
            isActive: product.isActive === false ? false : true,
            imageUrl: product.imageUrl || null,
          }
        });
        
        successCount++;
      } catch (error) {
        errors.push({
          row: i + 2,
          error: error.message
        });
      }
    }
    
    return { successCount, errors };
  }
  
  /**
   * Valida los datos de un producto
   * @param product Producto a validar
   * @param index Índice del producto en el archivo
   */
  private validateProductData(product: any, index: number) {
    if (!product.name || typeof product.name !== 'string' || product.name.trim() === '') {
      throw new Error('El nombre del producto es requerido');
    }
    
    if (isNaN(product.price) || product.price <= 0) {
      throw new Error('El precio debe ser un número mayor que cero');
    }
    
    if (isNaN(product.cost) || product.cost < 0) {
      throw new Error('El costo debe ser un número mayor o igual a cero');
    }
    
    if (isNaN(product.stock) || product.stock < 0 || !Number.isInteger(Number(product.stock))) {
      throw new Error('El stock debe ser un número entero mayor o igual a cero');
    }
    
    if (!product.category || typeof product.category !== 'string' || product.category.trim() === '') {
      throw new Error('La categoría del producto es requerida');
    }
  }

  /**
   * Genera una plantilla para la importación de productos
   * @param fileType Tipo de archivo (excel o csv)
   * @param res Objeto de respuesta
   */
  async generateTemplate(fileType: ImportFileType, res: Response) {
    // Datos de ejemplo para la plantilla
    const templateData = [
      {
        name: 'Producto Ejemplo 1',
        description: 'Descripción del producto 1',
        price: 100.00,
        cost: 80.00,
        stock: 10,
        category: 'Categoría Ejemplo',
        isActive: true,
        imageUrl: 'https://ejemplo.com/imagen.jpg'
      },
      {
        name: 'Producto Ejemplo 2',
        description: 'Descripción del producto 2',
        price: 200.00,
        cost: 150.00,
        stock: 5,
        category: 'Otra Categoría',
        isActive: true,
        imageUrl: ''
      }
    ];
    
    if (fileType === ImportFileType.EXCEL) {
      // Generar archivo Excel
      const worksheet = xlsx.utils.json_to_sheet(templateData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Productos');
      
      // Configurar la respuesta
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_productos.xlsx');
      
      // Enviar el archivo
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);
    } else if (fileType === ImportFileType.CSV) {
      // Generar archivo CSV
      const csvData = this.convertToCSV(templateData);
      
      // Configurar la respuesta
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_productos.csv');
      
      // Enviar el archivo
      res.send(csvData);
    } else {
      throw new BadRequestException('Tipo de archivo no soportado');
    }
  }

  /**
   * Convierte un array de objetos a formato CSV
   * @param data Array de objetos
   * @returns String en formato CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Añadir encabezados
    csvRows.push(headers.join(','));
    
    // Añadir filas de datos
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        // Escapar comillas y valores que contienen comas
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}