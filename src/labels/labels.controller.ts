import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExtractLabelDto } from './dto/extract-label.dto';
import { LabelExtractResponseDto } from './dto/label-extract-response.dto';
import { LabelsService } from './labels.service';

@ApiTags('labels')
@ApiBearerAuth()
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post('extract')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extrae datos de una etiqueta con Gemini Vision' })
  @ApiOkResponse({
    description: 'Datos extraídos (strings; "" si no se detectó)',
    type: LabelExtractResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido (base64, MIME o tamaño).',
  })
  @ApiResponse({
    status: 502,
    description: 'Gemini no disponible o devolvió algo inválido.',
  })
  extract(@Body() dto: ExtractLabelDto): Promise<LabelExtractResponseDto> {
    return this.labelsService.extract(dto);
  }
}
