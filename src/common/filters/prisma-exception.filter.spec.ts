import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: '6.13.0',
    meta,
  });
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    status = jest.fn().mockReturnThis();
    json = jest.fn();
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function run(code: string, meta?: Record<string, unknown>) {
    filter.catch(knownError(code, meta), host);
    return {
      code: status.mock.calls[0][0] as number,
      body: json.mock.calls[0][0],
    };
  }

  it('P2002 (unicidad) -> 409 con el campo en el mensaje', () => {
    const result = run('P2002', { target: ['email'] });
    expect(result.code).toBe(409);
    expect(JSON.stringify(result.body)).toContain('email');
  });

  it('P2002 con target escalar -> 409', () => {
    const result = run('P2002', { target: 'User_email_key' });
    expect(result.code).toBe(409);
    expect(JSON.stringify(result.body)).toContain('User_email_key');
  });

  it('P2003 (clave foranea) -> 409', () => {
    expect(run('P2003').code).toBe(409);
  });

  it('P2025 (registro inexistente) -> 404', () => {
    expect(run('P2025').code).toBe(404);
  });

  it('P2021/P2022 (tabla o columna inexistente) -> 500', () => {
    expect(run('P2021').code).toBe(500);
    expect(run('P2022').code).toBe(500);
  });

  it('codigo desconocido -> 500', () => {
    expect(run('P9999').code).toBe(500);
  });
});
