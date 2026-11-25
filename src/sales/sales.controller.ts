import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { SaleInvoiceDto } from './dto/sale-invoice.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { parsePagination } from '../common/pagination/pagination.utils';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Crear una nueva venta' })
  @ApiResponse({
    status: 201,
    description: 'La venta ha sido creada exitosamente.',
    type: SaleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({
    status: 404,
    description: 'Cliente o producto no encontrado.',
  })
  @ApiBody({ type: CreateSaleDto })
  create(
    @Body() createSaleDto: CreateSaleDto,
    @Req() req: Request,
  ): Promise<SaleResponseDto> {
    const user = req.user as { id: string } | undefined;
    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.salesService.create(createSaleDto, user.id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todas las ventas' })
  @ApiQuery({
    name: 'startDate',
    description: 'Fecha de inicio (YYYY-MM-DD)',
    required: false,
  })
  @ApiQuery({
    name: 'endDate',
    description: 'Fecha de fin (YYYY-MM-DD)',
    required: false,
  })
  @ApiQuery({
    name: 'customerId',
    description: 'ID del cliente',
    required: false,
  })
  @ApiQuery({
    name: 'quoteId',
    description: 'Filtra la venta originada por un presupuesto',
    required: false,
  })
  @ApiQuery({
    name: 'repairOrderId',
    description: 'Filtra las ventas de una orden de reparación',
    required: false,
  })
  @ApiQuery({
    name: 'page',
    description: 'Página (base 1, por defecto 1)',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Registros por página (por defecto 20, máx. 100)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description:
      'Retorna una página de ventas. El total de registros sin paginar se expone en la cabecera X-Total-Count',
    type: [SaleResponseDto],
  })
  async findAll(
    @Res({ passthrough: true }) res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerId') customerId?: string,
    @Query('quoteId') quoteId?: string,
    @Query('repairOrderId') repairOrderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<SaleResponseDto[]> {
    // Acepta tanto instantes ISO completos como fechas sueltas (YYYY-MM-DD).
    // Para fechas sueltas, `endDate` se extiende al final del día: antes se
    // interpretaba como medianoche y dejaba fuera las ventas de ese mismo día.
    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
    const parseStart = (value: string) =>
      DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
    const parseEnd = (value: string) =>
      DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);

    const startDateTime = startDate ? parseStart(startDate) : undefined;
    const endDateTime = endDate ? parseEnd(endDate) : undefined;
    const { skip, take } = parsePagination(page, limit);

    const { data, total } = await this.salesService.findAll({
      startDate: startDateTime,
      endDate: endDateTime,
      customerId,
      quoteId,
      repairOrderId,
      skip,
      take,
    });

    res.set('X-Total-Count', String(total));
    return data;
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener una venta por ID' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiResponse({
    status: 200,
    description: 'Retorna la venta',
    type: SaleResponseDto,
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
    type: SaleInvoiceDto,
  })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  generateInvoice(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SaleInvoiceDto> {
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
    type: SaleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSaleDto: UpdateSaleDto,
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
          example: 'Venta eliminada correctamente',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Error al eliminar la venta.' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.salesService.remove(id);
  }
}
