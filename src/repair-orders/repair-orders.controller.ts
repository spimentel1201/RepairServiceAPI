import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, Res, BadRequestException } from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { RepairOrderResponseDto } from './dto/repair-order-response.dto';
import { RepairOrder, RepairOrderStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { parsePagination } from '../common/pagination/pagination.utils';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('repair-orders')
@ApiBearerAuth()
@Controller('repair-orders')
export class RepairOrdersController {
  constructor(private readonly repairOrdersService: RepairOrdersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Crear una nueva orden de reparación' })
  @ApiResponse({ 
    status: 201, 
    description: 'La orden de reparación ha sido creada exitosamente.',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Cliente o técnico no encontrado.' })
  @ApiBody({ type: CreateRepairOrderDto })
  create(@Body() createRepairOrderDto: CreateRepairOrderDto): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.create(createRepairOrderDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todas las órdenes de reparación' })
  @ApiQuery({ name: 'status', description: 'Filtrar por estado de la orden', required: false, enum: RepairOrderStatus })
  @ApiQuery({ name: 'page', description: 'Página (base 1, por defecto 1)', required: false })
  @ApiQuery({ name: 'limit', description: 'Registros por página (por defecto 20, máx. 100)', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna una página de órdenes de reparación. El total de registros sin paginar se expone en la cabecera X-Total-Count',
    type: [RepairOrderResponseDto]
  })
  async findAll(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: RepairOrderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<RepairOrderResponseDto[]> {
    // El query param llega como texto: se valida contra el enum antes de tocar la BD
    if (status && !Object.values(RepairOrderStatus).includes(status)) {
      throw new BadRequestException(`Estado inválido: ${status}`);
    }

    const { skip, take } = parsePagination(page, limit);
    const { data, total } = await this.repairOrdersService.findAll({ status, skip, take });
    res.set('X-Total-Count', String(total));
    return data;
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener una orden de reparación por ID' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna la orden de reparación',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 404, description: 'Orden de reparación no encontrada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.findOne(id);
  }

  @Get('customer/:customerId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todas las órdenes de reparación de un cliente' })
  @ApiParam({ name: 'customerId', description: 'ID del cliente' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todas las órdenes de reparación del cliente',
    type: [RepairOrderResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findByCustomer(customerId);
  }

  @Get('technician/:technicianId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todas las órdenes de reparación de un técnico' })
  @ApiParam({ name: 'technicianId', description: 'ID del técnico' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todas las órdenes de reparación del técnico',
    type: [RepairOrderResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Técnico no encontrado.' })
  findByTechnician(@Param('technicianId', ParseUUIDPipe) technicianId: string): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findByTechnician(technicianId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Actualizar una orden de reparación' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ type: UpdateRepairOrderDto })
  @ApiResponse({ 
    status: 200, 
    description: 'La orden de reparación ha sido actualizada exitosamente.',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Orden de reparación, cliente o técnico no encontrado.' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateRepairOrderDto: UpdateRepairOrderDto
  ): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.update(id, updateRepairOrderDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar una orden de reparación' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiResponse({ 
    status: 200, 
    description: 'La orden de reparación ha sido eliminada exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Orden de reparación eliminada correctamente'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Orden de reparación no encontrada.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.repairOrdersService.remove(id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Actualizar el estado de una orden de reparación' })
  @ApiParam({ name: 'id', description: 'ID de la orden de reparación' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(RepairOrderStatus),
          example: RepairOrderStatus.IN_PROGRESS
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'El estado de la orden de reparación ha sido actualizado exitosamente.',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Orden de reparación no encontrada.' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body('status') status: RepairOrderStatus
  ): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.updateStatus(id, status);
  }
}