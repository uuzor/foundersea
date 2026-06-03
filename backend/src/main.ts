import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('FounderSea AI Agent Backend')
    .setDescription('AI Agent backend for FounderSea protocol - autonomous decision-making for idea scoring, milestone validation, and builder ranking')
    .setVersion('1.0')
    .addTag('agents', 'AI Agent endpoints')
    .addTag('ideas', 'Idea management')
    .addTag('milestones', 'Milestone validation')
    .addTag('builders', 'Builder ranking')
    .addTag('decisions', 'Decision history')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 FounderSea AI Agent Backend running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}

bootstrap();