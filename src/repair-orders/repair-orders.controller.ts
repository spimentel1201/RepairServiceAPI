import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Query
} from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, RepairOrderStatus } from '@prisma/client';
import { RepairOrderResponseDto } from './dto/repair-order-response.dto';

/**
 * Controlador para gestionar órdenes de reparación
 */
@Controller('repair-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepairOrdersController {
  constructor(private readonly repairOrdersService: RepairOrdersService) {}

  /**
   * Crea una nueva orden de reparación
   */
  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRepairOrderDto: CreateRepairOrderDto): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.create(createRepairOrderDto);
  }

  /**
   * Obtiene todas las órdenes de reparación
   */
  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  findAll(): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findAll();
  }

  /**
   * Obtiene una orden de reparación por su ID
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  findOne(@Param('id') id: string): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.findOne(id);
  }

  /**
   * Obtiene todas las órdenes de un cliente
   */
  @Get('customer/:customerId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  findByCustomer(@Param('customerId') customerId: string): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findByCustomer(customerId);
  }

  /**
   * Obtiene todas las órdenes asignadas a un técnico
   */
  @Get('technician/:technicianId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  findByTechnician(@Param('technicianId') technicianId: string): Promise<RepairOrderResponseDto[]> {
    return this.repairOrdersService.findByTechnician(technicianId);
  }

  /**
   * Actualiza una orden de reparación
   */
  @Patch(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  update(
    @Param('id') id: string, 
    @Body() updateRepairOrderDto: UpdateRepairOrderDto
  ): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.update(id, updateRepairOrderDto);
  }

  /**
   * Actualiza el estado de una orden
   */
  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  updateStatus(
    @Param('id') id: string, 
    @Body('status') status: RepairOrderStatus
  ): Promise<RepairOrderResponseDto> {
    return this.repairOrdersService.updateStatus(id, status);
  }

  /**
   * Elimina una orden de reparación
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.repairOrdersService.remove(id);
  }
}