import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { RepairOrderResponseDto } from './dto/repair-order-response.dto';
import { RepairOrderStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('repair-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todas las órdenes de reparación',
    type: [RepairOrderResponseDto]
  })
  findAll(): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findAll();
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