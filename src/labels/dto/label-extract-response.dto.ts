import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LabelExtractParsedDto {
  @ApiProperty({ example: 'LAPTOP' })
  deviceType: string;

  @ApiProperty({ example: 'HP' })
  brand: string;

  @ApiProperty({ example: '14-DK1025LA' })
  model: string;

  @ApiProperty({ example: '5CD1234ABC' })
  serialNumber: string;
}

export class LabelExtractResponseDto extends LabelExtractParsedDto {
  @ApiPropertyOptional({
    description:
      'Mismo resultado anidado (algunos clientes lo prefieren en parsed)',
    type: LabelExtractParsedDto,
  })
  parsed?: LabelExtractParsedDto;
}
