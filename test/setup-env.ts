// Valores por defecto para los tests e2e. No pisan las variables reales
// del entorno (en CI vienen del workflow; en local, del shell o del .env).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
process.env.ENABLE_SWAGGER = process.env.ENABLE_SWAGGER || 'false';
process.env.REGISTRATION_ENABLED = process.env.REGISTRATION_ENABLED || 'true';
// El throttler global limita a 10 req/min por defecto: un suite e2e hace mas.
process.env.THROTTLE_TTL = process.env.THROTTLE_TTL || '60000';
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT || '1000';
