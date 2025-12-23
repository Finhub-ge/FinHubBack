import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // app.enableCors({
  //   origin: [
  //     'https://new.myfinhub.info',  // Your production frontend
  //     'http://localhost:3000',       // Local development
  //     'http://localhost:5173',       // Vite default
  //   ],
  //   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  //   credentials: true,
  //   allowedHeaders: ['Content-Type', 'Authorization'],
  // });

  const config = new DocumentBuilder()
    .setTitle('FinHub Api')
    .setDescription('Full API description')
    .setVersion('1.0')
    .addTag('Finhub')
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
      persistAuthorization: true,
    },
  });
  //Serve raw JSON at /api-json
  app.use('/api-json', (req, res) => {
    res.json(document);
  });
  const reflector = app.get(Reflector)
  app.enableCors();
  await app.listen(4444);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
