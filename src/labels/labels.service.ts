import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractLabelDto } from './dto/extract-label.dto';
import { LabelExtractResponseDto } from './dto/label-extract-response.dto';

// Port de mantenimiento360/lib/ocr-gemini.ts (Next.js → NestJS), adaptado de
// maquinaria pesada a electrónica. Modelo y protocolo idénticos al origen.
// FREE TIER: gemini-flash-lite-latest — ~500 RPD.
const MODEL = 'gemini-flash-lite-latest';
const REINTENTOS = 2;
const ESPERA_BASE_MS = 1200;
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_OCR_TEXT_CHARS = 4000;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const SYSTEM_INSTRUCTION = `Eres un motor OCR especializado en etiquetas de aparatos electrónicos (TV, laptop, celular, tablet, monitor, consola, refrigerador, lavadora, microondas).

Antes de responder, lee la imagen con atención al detalle y transcribe mentalmente el texto visible de la etiqueta.

Extrae en español:
- deviceType: TV | LAPTOP | CELULAR | TABLET | MONITOR | CONSOLA | ELECTRODOMESTICO | OTRO
- brand: marca/fabricante (ej: Samsung, LG, HP, Xiaomi, Lenovo, Sony, Whirlpool)
- model: designación del modelo tal como está impresa (ej: 55TU7000, 14-DK1025LA, WM3400CW)
- serialNumber: número de serie / S/N / SN / Serial No. / IMEI tal como está impreso

Las etiquetas pueden estar en inglés o español. Patrones comunes:
- "MODEL: 55TU7000" o "MODEL NO. ..." → model: 55TU7000
- "MODEL CODE: LP156WH4" → model: LP156WH4
- "S/N: R38M90XK1" o "SERIAL NO. ..." → serialNumber: R38M90XK1
- "SN: ..." → serialNumber
- "IMEI: 356938035643809" → serialNumber: 356938035643809
- "MADE IN MEXICO / LG Electronics" → brand: LG
- "Samsung Electronics" en la etiqueta → brand: Samsung
- "TYPE: TV" o "Product: Laptop" → deviceType

Ignora el ruido de la etiqueta: logos regulatorios (UL, CE, FCC, NOM), códigos de barras, QR, tablas de voltaje/frecuencia, textos de seguridad y "MADE IN...". P/N y part numbers no son el número de serie.

Si un campo no se puede determinar, usa null. No inventes valores: transcribe exactamente lo impreso (espacios, guiones y mayúsculas tal como aparecen).
Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto adicional.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    deviceType: { type: 'STRING', nullable: true },
    brand: { type: 'STRING', nullable: true },
    model: { type: 'STRING', nullable: true },
    serialNumber: { type: 'STRING', nullable: true },
  },
  required: ['brand', 'model', 'serialNumber'],
};

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

@Injectable()
export class LabelsService {
  constructor(private configService: ConfigService) {}

  /**
   * Extrae los datos de una etiqueta con Gemini Vision.
   * Valida el payload (400), llama a Gemini con reintentos en 429/503 y
   * devuelve siempre strings ('' si no se detectó) + el objeto `parsed`.
   */
  async extract(dto: ExtractLabelDto): Promise<LabelExtractResponseDto> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || !apiKey.trim()) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY no está configurada',
      );
    }

    const { imageBase64, mimeType } = this.validarEntrada(dto);
    const ocrHint =
      typeof dto.ocrText === 'string' && dto.ocrText.trim() !== ''
        ? dto.ocrText.slice(0, MAX_OCR_TEXT_CHARS)
        : '';

    // El hint local ancla al modelo: si va, siempre con advertencia de que la
    // imagen manda (el OCR local es ruidoso y arrastró errores en pruebas).
    const hintLine =
      ocrHint !== ''
        ? `Texto OCR previo (puede contener errores, verifícalo contra la imagen): ${ocrHint}\n`
        : '';
    const userText = `${hintLine}Extrae los datos de esta etiqueta de aparato electrónico.`;

    let res: Response | null = null;
    let ultimoStatus = 0;

    for (let intento = 0; intento < REINTENTOS; intento++) {
      res = await fetch(`${API}/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: userText },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.1,
          },
        }),
      });

      if (res.ok) break;

      ultimoStatus = res.status;
      // Consumir el body para no dejar el socket colgado; el detalle solo se
      // usa en diagnóstico interno, al cliente sale mensaje genérico.
      await res.text().catch(() => '');
      const reintentable = res.status === 503 || res.status === 429;
      if (!reintentable || intento === REINTENTOS - 1) break;
      await esperar(ESPERA_BASE_MS * (intento + 1));
    }

    if (!res || !res.ok) {
      if (ultimoStatus === 503 || ultimoStatus === 429) {
        throw new BadGatewayException('Gemini ocupado, reintenta');
      }
      throw new BadGatewayException(
        `Gemini Vision API respondió ${ultimoStatus}`,
      );
    }

    const data: any = await res.json();
    const texto: unknown =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof texto !== 'string' || texto.trim() === '') {
      throw new BadGatewayException('Respuesta no válida de Gemini');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(texto);
    } catch {
      throw new BadGatewayException('Respuesta no válida de Gemini');
    }

    const flat = {
      deviceType: toText(parsed?.deviceType),
      brand: toText(parsed?.brand),
      model: toText(parsed?.model),
      serialNumber: toText(parsed?.serialNumber),
    };
    return { ...flat, parsed: { ...flat } };
  }

  /**
   * Normaliza y valida la entrada. Devuelve el base64 limpio y el MIME
   * normalizado (`image/jpg` → `image/jpeg`).
   * @throws BadRequestException con mensaje en español.
   */
  private validarEntrada(dto: ExtractLabelDto): {
    imageBase64: string;
    mimeType: string;
  } {
    let mime = String(dto.mimeType ?? '')
      .trim()
      .toLowerCase();
    if (mime === 'image/jpg') mime = 'image/jpeg';
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      throw new BadRequestException(
        'mimeType no soportado (usa image/jpeg, image/png, image/webp o image/heic)',
      );
    }

    const raw = String(dto.imageBase64 ?? '').replace(/\s+/g, '');
    if (raw === '') {
      throw new BadRequestException('imageBase64 es requerido');
    }
    if (raw.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
      throw new BadRequestException('imageBase64 no es un base64 válido');
    }
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('imageBase64 no es un base64 válido');
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        'La imagen supera el máximo de 5 MB (comprime antes de enviarla)',
      );
    }

    return { imageBase64: raw, mimeType: mime };
  }
}
