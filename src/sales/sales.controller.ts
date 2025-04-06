import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards, Req } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { SaleInvoiceDto } from './dto/sale-invoice.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Request } from 'express';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Crear una nueva venta' })
  @ApiResponse({ 
    status: 201, 
    description: 'La venta ha sido creada exitosamente.',
    type: SaleResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Cliente o producto no encontrado.' })
  @ApiBody({ type: CreateSaleDto })
  create(@Body() createSaleDto: CreateSaleDto, @Req() req: Request): Promise<SaleResponseDto> {
    const userId = req.user['id'];
    return this.salesService.create(createSaleDto, userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todas las ventas' })
  @ApiQuery({ name: 'startDate', description: 'Fecha de inicio (YYYY-MM-DD)', required: false })
  @ApiQuery({ name: 'endDate', description: 'Fecha de fin (YYYY-MM-DD)', required: false })
  @ApiQuery({ name: 'customerId', description: 'ID del cliente', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todas las ventas',
    type: [SaleResponseDto]
  })
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerId') customerId?: string,
  ): Promise<SaleResponseDto[]> {
    const startDateTime = startDate ? new Date(startDate) : undefined;
    const endDateTime = endDate ? new Date(endDate) : undefined;
    
    return this.salesService.findAll(startDateTime, endDateTime, customerId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener una venta por ID' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna la venta',
    type: SaleResponseDto
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SaleResponseDto> {
    return this.salesService.findOne(id);
  }

  @Get(':id/invoice')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Generar factura o ticket para una venta' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna la factura o ticket',
    type: SaleInvoiceDto
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  generateInvoice(@Param('id', ParseUUIDPipe) id: string): Promise<SaleInvoiceDto> {
    return this.salesService.generateInvoice(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar una venta' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiBody({ type: UpdateSaleDto })
  @ApiResponse({ 
    status: 200, 
    description: 'La venta ha sido actualizada exitosamente.',
    type: SaleResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateSaleDto: UpdateSaleDto
  ): Promise<SaleResponseDto> {
    return this.salesService.update(id, updateSaleDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar una venta' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiResponse({ 
    status: 200, 
    description: 'La venta ha sido eliminada exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Venta eliminada correctamente'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Error al eliminar la venta.' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.salesService.remove(id);
  }
}