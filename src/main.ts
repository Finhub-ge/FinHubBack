import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
   app.useGlobalPipes(
    new ValidationPipe({}),
  );
  const configService = app.get(ConfigService);

  const swaggerPrefix = configService.get<string>('SWAGGER_PREFIX') ?? '';

  const config = new DocumentBuilder()
    .setTitle('FinHub Api')
    .setDescription('Full API description')
    .setVersion('1.0')
    .addTag('Finhub')
    .addServer(swaggerPrefix)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      security: [{ 'bearer': [] }],
    },
  });
  const reflector = app.get(Reflector)
  app.enableCors();
  await app.listen(4444);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
