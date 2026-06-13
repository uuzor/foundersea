"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const blockchain_module_1 = require("./blockchain/blockchain.module");
const agents_module_1 = require("./agents/agents.module");
const ideas_module_1 = require("./ideas/ideas.module");
const rate_limit_guard_1 = require("./common/rate-limit.guard");
const security_middleware_1 = require("./common/security.middleware");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
                cache: true,
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: rate_limit_guard_1.RATE_LIMITS.PUBLIC.ttl,
                    limit: rate_limit_guard_1.RATE_LIMITS.PUBLIC.limit,
                    name: 'default',
                },
            ]),
            blockchain_module_1.BlockchainModule,
            agents_module_1.AgentsModule,
            ideas_module_1.IdeasModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            security_middleware_1.EncryptedWalletService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map