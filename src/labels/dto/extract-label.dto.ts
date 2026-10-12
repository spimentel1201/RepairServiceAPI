import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExtractLabelDto {
  @ApiProperty({
    description: 'Imagen de la etiqueta en base64 (sin prefijo data:)',
    example: '/9j/4AAQSkZJRg...',
  })
  @IsString({ message: 'imageBase64 debe ser un string en base64' })
  @IsNotEmpty({ message: 'imageBase64 es requerido' })
  imageBase64: string;

  @ApiProperty({
    description: 'MIME de la imagen',
    enum: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    example: 'image/jpeg',
  })
  @IsString({ message: 'mimeType debe ser un string' })
  @IsNotEmpty({ message: 'mimeType es requerido' })
  mimeType: string;

  @ApiPropertyOptional({
    description:
      'Texto OCR local opcional: se envía a Gemini como hint y sube la precisión',
    example: 'MODEL: 14-DK1025LA S/N: 5CD1234ABC',
  })
  @IsOptional()
  @IsString({ message: 'ocrText debe ser un string' })
  ocrText?: string;
}
