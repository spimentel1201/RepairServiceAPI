import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { CustomerHistoryDto } from './dto/customer-history.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Crear un nuevo cliente' })
  @ApiResponse({ 
    status: 201, 
    description: 'El cliente ha sido creado exitosamente.',
    type: CustomerResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 409, description: 'Conflicto: El email o número de documento ya existe.' })
  @ApiBody({ type: CreateCustomerDto })
  create(@Body() createCustomerDto: CreateCustomerDto): Promise<CustomerResponseDto> {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todos los clientes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todos los clientes',
    type: [CustomerResponseDto]
  })
  findAll(): Promise<CustomerResponseDto[]> {
    return this.customersService.findAll();
  }

  @Get('search')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Buscar clientes por nombre, email, teléfono o número de documento' })
  @ApiQuery({ name: 'query', description: 'Término de búsqueda', required: true })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna los clientes que coinciden con la búsqueda',
    type: [CustomerResponseDto]
  })
  search(@Query('query') query: string): Promise<CustomerResponseDto[]> {
    return this.customersService.search(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener un cliente por ID' })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna el cliente',
    type: CustomerResponseDto
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerResponseDto> {
    return this.customersService.findOne(id);
  }

  @Get(':id/history')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener el historial de un cliente (órdenes de reparación y presupuestos)' })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna el historial del cliente',
    type: CustomerHistoryDto
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  getHistory(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerHistoryDto> {
    return this.customersService.getHistory(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Actualizar un cliente' })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({ 
    status: 200, 
    description: 'El cliente ha sido actualizado exitosamente.',
    type: CustomerResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto: El email o número de documento ya existe.' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateCustomerDto: UpdateCustomerDto
  ): Promise<CustomerResponseDto> {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un cliente' })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({ 
    status: 200, 
    description: 'El cliente ha sido eliminado exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Cliente eliminado correctamente'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'No se puede eliminar el cliente porque tiene relaciones asociadas.' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.customersService.remove(id);
  }

  @Post(':customerId/notify/:repairOrderId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Enviar notificación al cliente sobre el estado de su orden de reparación' })
  @ApiParam({ name: 'customerId', description: 'ID del cliente' })
  @ApiParam({ name: 'repairOrderId', description: 'ID de la orden de reparación' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Su orden de reparación ha sido actualizada a estado EN PROGRESO'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'La notificación ha sido enviada exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Notificación enviada correctamente'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Cliente u orden de reparación no encontrada.' })
  sendNotification(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('repairOrderId', ParseUUIDPipe) repairOrderId: string,
    @Body('message') message: string,
  ): Promise<{ message: string }> {
    return this.customersService.sendNotification(customerId, repairOrderId, message);
  }
}