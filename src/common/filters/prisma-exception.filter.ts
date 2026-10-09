import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Convierte los errores conocidos de Prisma en respuestas HTTP con sentido.
 *
 * Sin este filtro, cualquier error de base de datos terminaba convertido en un
 * 400 genérico (o en un 500 sin informacion). El mapeo es:
 *
 * | Codigo  | Significado                      | HTTP |
 * |---------|----------------------------------|------|
 * | P2002   | Restriccion de unicidad           | 409  |
 * | P2003   | Clave foranea invalida            | 409  |
 * | P2025   | Registro a modificar no existe    | 404  |
 * | P2021/P2022 | Tabla/columna inexistente      | 500  |
 * | resto   | Error no contemplado              | 500  |
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttpException(exception);

    if (httpException.getStatus() >= 500) {
      // El detalle solo queda en el servidor: no se filtra informacion interna
      this.logger.error(
        `Error de Prisma ${exception.code}: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(httpException.getStatus()).json(httpException.getResponse());
  }

  private toHttpException(exception: Prisma.PrismaClientKnownRequestError): HttpException {
    switch (exception.code) {
      case 'P2002': {
        const rawTarget = exception.meta?.target;
        const target = Array.isArray(rawTarget)
          ? (rawTarget as string[]).join(', ')
          : String(rawTarget ?? 'el registro');
        return new ConflictException(`Ya existe un registro con ese valor en: ${target}`);
      }

      case 'P2003':
        return new ConflictException(
          'No se puede completar la operación: el registro referenciado no existe o tiene datos asociados',
        );

      case 'P2025':
        return new NotFoundException('El registro que se intenta modificar o eliminar no existe');

      case 'P2021':
      case 'P2022':
        return new InternalServerErrorException('Error de esquema en la base de datos');

      default:
        return new InternalServerErrorException('Error interno al consultar la base de datos');
    }
  }
}
