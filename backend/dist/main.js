"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    process.on('unhandledRejection', (reason) => {
        console.error('Unhandled promise rejection:', reason);
    });
    process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error);
    });
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    const config = new swagger_1.DocumentBuilder()
        .setTitle('FounderSea AI Agent Backend')
        .setDescription('AI Agent backend for FounderSea protocol - autonomous decision-making for idea scoring, milestone validation, and builder ranking')
        .setVersion('1.0')
        .addTag('agents', 'AI Agent endpoints')
        .addTag('ideas', 'Idea management')
        .addTag('milestones', 'Milestone validation')
        .addTag('builders', 'Builder ranking')
        .addTag('decisions', 'Decision history')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, document);
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`🚀 FounderSea AI Agent Backend running on http://localhost:${port}`);
    console.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map