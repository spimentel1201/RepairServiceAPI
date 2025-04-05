import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UseGuards, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { QuoteStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo presupuesto' })
  @ApiResponse({ 
    status: 201, 
    description: 'El presupuesto ha sido creado exitosamente.',
    type: QuoteResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Orden de reparación, cliente o técnico no encontrado.' })
  @ApiBody({ type: CreateQuoteDto })
  create(@Body() createQuoteDto: CreateQuoteDto): Promise<QuoteResponseDto> {
    return this.quotesService.create(createQuoteDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todos los presupuestos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todos los presupuestos',
    type: [QuoteResponseDto]
  })
  findAll(): Promise<QuoteResponseDto[]> {
    return this.quotesService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener un presupuesto por ID' })
  @ApiParam({ name: 'id', description: 'ID del presupuesto' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna el presupuesto',
    type: QuoteResponseDto
  })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<QuoteResponseDto> {
    return this.quotesService.findOne(id);
  }

  @Get('repair-order/:repairOrderId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todos los presupuestos de una orden de reparación' })
  @ApiParam({ name: 'repairOrderId', description: 'ID de la orden de reparación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todos los presupuestos de la orden de reparación',
    type: [QuoteResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Orden de reparación no encontrada.' })
  findByRepairOrder(@Param('repairOrderId', ParseUUIDPipe) repairOrderId: string): Promise<QuoteResponseDto[]> {
    return this.quotesService.findByRepairOrder(repairOrderId);
  }

  @Get('customer/:customerId')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Obtener todos los presupuestos de un cliente' })
  @ApiParam({ name: 'customerId', description: 'ID del cliente' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna todos los presupuestos del cliente',
    type: [QuoteResponseDto]
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado.' })
  findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string): Promise<QuoteResponseDto[]> {
    return this.quotesService.findByCustomer(customerId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar un presupuesto' })
  @ApiParam({ name: 'id', description: 'ID del presupuesto' })
  @ApiBody({ type: UpdateQuoteDto })
  @ApiResponse({ 
    status: 200, 
    description: 'El presupuesto ha sido actualizado exitosamente.',
    type: QuoteResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Presupuesto, orden de reparación, cliente o técnico no encontrado.' })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateQuoteDto: UpdateQuoteDto
  ): Promise<QuoteResponseDto> {
    return this.quotesService.update(id, updateQuoteDto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar el estado de un presupuesto' })
  @ApiParam({ name: 'id', description: 'ID del presupuesto' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(QuoteStatus),
          example: QuoteStatus.APPROVED
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'El estado del presupuesto ha sido actualizado exitosamente.',
    type: QuoteResponseDto
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado.' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body('status') status: QuoteStatus
  ): Promise<QuoteResponseDto> {
    return this.quotesService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un presupuesto' })
  @ApiParam({ name: 'id', description: 'ID del presupuesto' })
  @ApiResponse({ 
    status: 200, 
    description: 'El presupuesto ha sido eliminado exitosamente.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Presupuesto eliminado correctamente'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.quotesService.remove(id);
  }

  @Post(':id/send-email')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Enviar presupuesto por email' })
  @ApiParam({ name: 'id', description: 'ID del presupuesto' })
  @ApiResponse({ 
    status: 200, 
    description: 'El presupuesto ha sido enviado exitosamente por email.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Presupuesto enviado por email correctamente'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta.' })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado.' })
  async sendEmail(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    // Verificar si el presupuesto existe
    await this.quotesService.findOne(id);
    
    // Aquí iría la lógica para enviar el email
    // Por ahora solo retornamos un mensaje de éxito
    return { message: 'Presupuesto enviado por email correctamente' };
  }
  /*
  @Get(':id/whatsapp-link')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Obtener enlace para enviar presupuesto por WhatsApp' })
  @ApiParam({ name: 'id', description: 'ID del presupuesto' })
  @ApiResponse({ 
    status: 200, 
    description: 'Retorna el enlace para enviar el presupuesto por WhatsApp.',
    schema: {
      type: 'object',
      properties: {
        whatsappLink: {
          type: 'string',
          example: 'https://wa.me/1234567890?text=Presupuesto%20para%20su%20reparación'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Presupuesto no encontrado.' })
  async getWhatsAppLink(@Param('id', ParseUUIDPipe) id: string): Promise<{ whatsappLink: string }> {
    // Obtener el presupuesto
    const quote = await this.quotesService.findOne(id);
    
    // Obtener el cliente para su número de teléfono
    const customer = await this.prisma.customer.findUnique({
      where: { id: quote.customerId },
    });
    
    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${quote.customerId} no encontrado`);
    }
    
    // Crear el mensaje para WhatsApp
    const message = `Hola ${customer.name}, le enviamos el presupuesto para su reparación. El monto total es de $${quote.totalAmount}. Por favor, responda para aprobar o rechazar el presupuesto.`;
    
    // Crear el enlace de WhatsApp
    const whatsappLink = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`;
    
    return { whatsappLink };
  }*/
}