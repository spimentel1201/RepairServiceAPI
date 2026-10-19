import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LabelsService } from './labels.service';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=test-key';

function okResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  } as any;
}

function failResponse(status: number, body = 'error-body') {
  return {
    ok: false,
    status,
    text: async () => body,
  } as any;
}

function geminiPayload(text: string | null) {
  return JSON.stringify({
    deviceType: 'LAPTOP',
    brand: 'HP',
    model: '14-DK1025LA',
    serialNumber: text,
  });
}

describe('LabelsService', () => {
  let service: LabelsService;
  let config: any;
  let fetchMock: jest.Mock;
  const imageBase64 = Buffer.from('fake-image-bytes').toString('base64');

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue('test-key') };
    service = new LabelsService(config as any);
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  function baseDto(overrides: Record<string, unknown> = {}) {
    return {
      imageBase64,
      mimeType: 'image/jpeg',
      ...overrides,
    } as any;
  }

  it('devuelve campos planos + parsed con un 200 válido', async () => {
    fetchMock.mockResolvedValue(okResponse(geminiPayload('5CD1234ABC')));
    const result = await service.extract(baseDto());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(GEMINI_URL);
    expect(result).toMatchObject({
      deviceType: 'LAPTOP',
      brand: 'HP',
      model: '14-DK1025LA',
      serialNumber: '5CD1234ABC',
    });
    expect(result.parsed).toEqual({
      deviceType: 'LAPTOP',
      brand: 'HP',
      model: '14-DK1025LA',
      serialNumber: '5CD1234ABC',
    });
  });

  it('mapea null a string vacío', async () => {
    fetchMock.mockResolvedValue(okResponse(geminiPayload(null)));
    const result = await service.extract(baseDto());
    expect(result.serialNumber).toBe('');
    expect(result.deviceType).toBe('LAPTOP');
  });

  it('reintenta una vez ante 503 y luego tiene éxito', async () => {
    fetchMock
      .mockResolvedValueOnce(failResponse(503, 'overloaded'))
      .mockResolvedValueOnce(okResponse(geminiPayload('S1')));
    const result = await service.extract(baseDto());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.serialNumber).toBe('S1');
  });

  it('503 persistente → 502 ocupado', async () => {
    fetchMock.mockResolvedValue(failResponse(503));
    await expect(service.extract(baseDto())).rejects.toThrow(
      BadGatewayException,
    );
    await expect(service.extract(baseDto())).rejects.toThrow(
      'Gemini ocupado, reintenta',
    );
    expect(fetchMock).toHaveBeenCalledTimes(4); // 2 intentos x 2 llamadas
  });

  it('429 persistente → 502 ocupado', async () => {
    fetchMock.mockResolvedValue(failResponse(429));
    await expect(service.extract(baseDto())).rejects.toThrow(
      'Gemini ocupado, reintenta',
    );
  });

  it('otro status (400) no reintenta y devuelve 502 con el status', async () => {
    fetchMock.mockResolvedValue(failResponse(400, 'bad request'));
    await expect(service.extract(baseDto())).rejects.toThrow(
      'Gemini Vision API respondió 400',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('JSON inválido → 502', async () => {
    fetchMock.mockResolvedValue(okResponse('esto no es json {'));
    await expect(service.extract(baseDto())).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('respuesta sin texto → 502', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    } as any);
    await expect(service.extract(baseDto())).rejects.toThrow(
      'Respuesta no válida de Gemini',
    );
  });

  it('sin GEMINI_API_KEY → 500 sin llamar a fetch', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.extract(baseDto())).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mime fuera de whitelist → 400', async () => {
    await expect(
      service.extract(baseDto({ mimeType: 'image/gif' })),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normaliza image/jpg → image/jpeg', async () => {
    fetchMock.mockResolvedValue(okResponse(geminiPayload('S1')));
    await service.extract(baseDto({ mimeType: 'image/jpg' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(
      body.contents[0].parts[0].inlineData.mimeType,
    ).toBe('image/jpeg');
  });

  it('base64 inválido → 400', async () => {
    await expect(
      service.extract(baseDto({ imageBase64: '!!!no-base64!!!' })),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('imagen mayor a 5 MB → 400', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');
    await expect(service.extract(baseDto({ imageBase64: big }))).rejects.toThrow(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ocrText se trunca a 4000 chars en el hint y advierte que el OCR local es ruidoso', async () => {
    fetchMock.mockResolvedValue(okResponse(geminiPayload('S1')));
    await service.extract(baseDto({ ocrText: 'x'.repeat(5000) }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const hint: string = body.contents[0].parts[1].text;
    expect(hint).toContain('Texto OCR previo');
    expect(hint).toContain('puede contener errores');
    expect(hint).toContain('verifícalo contra la imagen');
    expect(hint).toContain('x'.repeat(100));
    expect(hint.length).toBeLessThanOrEqual(5000);
  });

  it('sin ocrText no incluye el hint, solo el prompt base', async () => {
    fetchMock.mockResolvedValue(okResponse(geminiPayload('S1')));
    await service.extract(baseDto());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[1].text).toBe(
      'Extrae los datos de esta etiqueta de aparato electrónico.',
    );
  });
});
