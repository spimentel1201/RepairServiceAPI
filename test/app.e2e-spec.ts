import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tests de integracion contra una base de datos PostgreSQL real.
 * Requiere DATABASE_URL apuntando a una BD con las migraciones aplicadas
 * (en CI: servicio postgres:17 + `npx prisma migrate deploy`).
 */
describe('RepairServiceAPI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let techToken: string;
  let productId: string;
  const suffix = Date.now();
  const techEmail = `e2e-tech-${suffix}@test.local`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL es obligatoria para los tests e2e (ver .github/workflows/ci.yml)',
      );
    }
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // El mismo pipeline de produccion: ValidationPipe, filtro de Prisma, CORS
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health responde ok y toca la base de datos', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('up');
  });

  it('las rutas protegidas rechazan peticiones sin token', async () => {
    await request(app.getHttpServer()).get('/customers').expect(401);
  });

  it('POST /auth/register crea un usuario con rol TECHNICIAN', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: techEmail,
        password: 'clave-e2e-123',
        firstName: 'E2E',
        lastName: 'Tester',
        phone: '999999999',
      })
      .expect(201);

    expect(res.body.role).toBe('TECHNICIAN');
    expect(res.body.password).toBeUndefined();
  });

  it('POST /auth/login devuelve un token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: techEmail, password: 'clave-e2e-123' })
      .expect(200);

    expect(res.body.access_token).toBeTruthy();
    techToken = res.body.access_token;
  });

  it('un tecnico no puede crear productos (solo ADMIN)', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        name: `Prod e2e ${suffix}`,
        price: 25.5,
        cost: 10,
        stock: 5,
        category: 'test',
      })
      .expect(403);
  });

  it('POST /sales usa el precio del catalogo e ignora el precio del cliente', async () => {
    // Preparacion de datos: crear producto es solo ADMIN, asi que se crea
    // directo en la BD y la API se prueba desde el punto del tecnico.
    const product = await prisma.product.create({
      data: {
        name: `Prod e2e ${suffix}`,
        description: 'producto de prueba e2e',
        price: 25.5,
        cost: 10,
        stock: 5,
        category: 'test',
        isActive: true,
      },
    });
    productId = product.id;

    const res = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        customerName: 'Cliente e2e',
        paymentMethod: 'CASH',
        items: [{ productId, quantity: 2, price: 1 }],
      })
      .expect(201);

    expect(res.body.totalAmount).toBe(51); // 25.5 * 2, no 1 * 2
    expect(res.body.items[0].price).toBe(25.5);
  });

  it('la venta descuenta el stock en la base de datos', async () => {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(product?.stock).toBe(3);
  });

  it('rechaza una venta sin stock suficiente', async () => {
    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        customerName: 'Cliente e2e',
        paymentMethod: 'CASH',
        items: [{ productId, quantity: 10 }],
      })
      .expect(400);
  });

  it('GET /sales pagina y expone X-Total-Count', async () => {
    const res = await request(app.getHttpServer())
      .get('/sales?page=1&limit=5')
      .set('Authorization', `Bearer ${techToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(Number(res.headers['x-total-count'])).toBeGreaterThanOrEqual(1);
  });

  it('validacion estricta: los campos desconocidos se rechazan con 400', async () => {
    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        customerName: 'X',
        paymentMethod: 'CASH',
        items: [{ productId, quantity: 1 }],
        campoRaro: true,
      })
      .expect(400);
  });
});
