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
  @ApiOperation({ summary: 'Create a new repair order' })
  @ApiResponse({ 
    status: 201, 
    description: 'The repair order has been successfully created.',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Customer or technician not found.' })
  @ApiBody({ type: CreateRepairOrderDto })
  create(@Body() createRepairOrderDto: CreateRepairOrderDto): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.create(createRepairOrderDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Get all repair orders' })
  @ApiResponse({ 
    status: 200, 
    description: 'Return all repair orders',
    type: [RepairOrderResponseDto]
  })
  findAll(): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Get a repair order by ID' })
  @ApiParam({ name: 'id', description: 'Repair order ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Return the repair order',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 404, description: 'Repair order not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.findOne(id);
  }

  @Get('customer/:customerId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Get all repair orders for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Return all repair orders for the customer',
    type: [RepairOrderResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findByCustomer(customerId);
  }

  @Get('technician/:technicianId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Get all repair orders for a technician' })
  @ApiParam({ name: 'technicianId', description: 'Technician ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Return all repair orders for the technician',
    type: [RepairOrderResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Technician not found.' })
  findByTechnician(@Param('technicianId', ParseUUIDPipe) technicianId: string): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findByTechnician(technicianId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Update a repair order' })
  @ApiParam({ name: 'id', description: 'Repair order ID' })
  @ApiBody({ type: UpdateRepairOrderDto })
  @ApiResponse({ 
    status: 200, 
    description: 'The repair order has been successfully updated.',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Repair order, customer, or technician not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateRepairOrderDto: UpdateRepairOrderDto
  ): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.update(id, updateRepairOrderDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a repair order' })
  @ApiParam({ name: 'id', description: 'Repair order ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'The repair order has been successfully deleted.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Repair order deleted successfully'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Repair order not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.repairOrdersService.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update the status of a repair order' })
  @ApiParam({ name: 'id', description: 'Repair order ID' })
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
    description: 'The repair order status has been successfully updated.',
    type: RepairOrderResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Repair order not found.' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body('status') status: RepairOrderStatus
  ): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.updateStatus(id, status);
  }
}