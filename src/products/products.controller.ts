import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ImportProductsDto, ImportFileType } from './dto/import-products.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as Multer from 'multer';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo producto' })
  @ApiResponse({ 
    status: 201, 
    description: 'El producto ha sido creado exitosamente.',
    type: ProductResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 409, description: 'Conflicto: Ya existe un producto con ese nombre.' })
  @ApiBody({ type: CreateProductDto })
  create(@Body() createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiQuery({ name: 'category', description: 'Filtrar por categoría', required: false })
  @ApiQuery({ name: 'active', description: 'Filtrar por estado activo/inactivo', required: false, type: Boolean })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todos los productos',
    type: [ProductResponseDto]
  })
  findAll(
    @Query('category') category?: string,
    @Query('active') active?: boolean,
  ): Promise<ProductResponseDto[]> {
    return this.productsService.findAll(category, active);
  }

  @Get('search')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Buscar productos por nombre, descripción o categoría' })
  @ApiQuery({ name: 'query', description: 'Término de búsqueda', required: true })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna los productos que coinciden con la búsqueda',
    type: [ProductResponseDto]
  })
  search(@Query('query') query: string): Promise<ProductResponseDto[]> {
    return this.productsService.search(query);
  }

  @Get('categories')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todas las categorías de productos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todas las categorías únicas',
    schema: {
      type: 'array',
      items: {
        type: 'string',
        example: 'Repuestos'
      }
    }
  })
  getCategories(): Promise<string[]> {
    return this.productsService.getCategories();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener un producto por ID' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna el producto',
    type: ProductResponseDto
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar un producto' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ 
    status: 200, 
    description: 'El producto ha sido actualizado exitosamente.',
    type: ProductResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto: Ya existe otro producto con ese nombre.' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateProductDto: UpdateProductDto
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/stock')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar el stock de un producto' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        quantity: {
          type: 'number',
          example: 10,
          description: 'Cantidad a añadir (positiva) o restar (negativa)'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'El stock del producto ha sido actualizado exitosamente.',
    type: ProductResponseDto
  })
  @ApiResponse({ status: 400, description: 'No hay suficiente stock disponible.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  updateStock(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body('quantity') quantity: number
  ): Promise<ProductResponseDto> {
    return this.productsService.updateStock(id, quantity);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un producto' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({ 
    status: 200, 
    description: 'El producto ha sido eliminado o marcado como inactivo exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Producto eliminado correctamente'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Error al eliminar el producto.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.productsService.remove(id);
  }
  
    @Post('import')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Importar productos desde un archivo Excel o CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo Excel (.xlsx) o CSV (.csv)'
        },
        fileType: {
          type: 'string',
          enum: Object.values(ImportFileType),
          description: 'Tipo de archivo (excel o csv)'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Los productos han sido importados exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        importedCount: { type: 'number' },
        errors: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              error: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Formato de archivo incorrecto o datos inválidos.' })
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(
    @UploadedFile() file: Express.Multer.File,
    @Body('fileType') fileType: ImportFileType
  ) {
    return this.productsService.importProducts(file, fileType);
  }

  @Get('import/template')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Descargar plantilla para importación de productos' })
  @ApiQuery({ 
    name: 'fileType', 
    enum: ImportFileType, 
    description: 'Tipo de archivo de la plantilla (excel o csv)' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Plantilla generada exitosamente',
  })
  downloadTemplate(
    @Query('fileType') fileType: ImportFileType,
    @Res() res: Response
  ) {
    return this.productsService.generateTemplate(fileType, res);
  }
}

