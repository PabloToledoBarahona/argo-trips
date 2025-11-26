"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const app_module_js_1 = require("./app.module.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule, { bufferLogs: true });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.setGlobalPrefix('api/trips');
    app.enableCors();
    const port = process.env.PORT || 3000;
    await app.listen(port);
    const logger = app.get(nestjs_pino_1.Logger);
    logger.log(`🚀 MS04-TRIPS running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map