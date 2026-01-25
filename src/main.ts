import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Tus configuraciones (ValidationPipe, etc.)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Tu configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Repair Service API')
    .setDescription('API for managing repair services')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors();
  
  await app.listen(3000);
}
if (require.main === module) {
    bootstrap();
}

export default async (req, res) => {
    const app = await NestFactory.create(AppModule);
    
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    const config = new DocumentBuilder().setTitle('Repair Service API').setVersion('1.0').addBearerAuth().build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    app.enableCors();

    await app.init();
    
    const expressApp = app.getHttpAdapter().getInstance();
    return expressApp(req, res);
};