"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainModule = void 0;
const common_1 = require("@nestjs/common");
const contract_service_1 = require("./contract.service");
const deployment_service_1 = require("./deployment.service");
const wallet_service_1 = require("./wallet.service");
const config_module_1 = require("../config/config.module");
const security_middleware_1 = require("../common/security.middleware");
let BlockchainModule = class BlockchainModule {
};
exports.BlockchainModule = BlockchainModule;
exports.BlockchainModule = BlockchainModule = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.AppConfigModule],
        providers: [contract_service_1.ContractService, deployment_service_1.DeploymentService, wallet_service_1.WalletService, security_middleware_1.EncryptedWalletService],
        exports: [contract_service_1.ContractService, deployment_service_1.DeploymentService, wallet_service_1.WalletService, security_middleware_1.EncryptedWalletService],
    })
], BlockchainModule);
//# sourceMappingURL=blockchain.module.js.map