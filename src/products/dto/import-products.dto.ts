import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum ImportFileType {
  EXCEL = 'excel',
  CSV = 'csv'
}

export class ImportProductsDto {
  @ApiProperty({ enum: ImportFileType, enumName: 'ImportFileType', description: 'Tipo de archivo a importar' })
  @IsEnum(ImportFileType)
  fileType: ImportFileType;
}