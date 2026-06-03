"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsModule = void 0;
const common_1 = require("@nestjs/common");
const tools_service_1 = require("./tools.service");
const github_tools_1 = require("./github.tools");
const web_tools_1 = require("./web.tools");
const blockchain_tools_1 = require("./blockchain.tools");
const ipfs_tools_1 = require("./ipfs.tools");
let ToolsModule = class ToolsModule {
};
exports.ToolsModule = ToolsModule;
exports.ToolsModule = ToolsModule = __decorate([
    (0, common_1.Module)({
        providers: [tools_service_1.ToolsService, github_tools_1.GithubTools, web_tools_1.WebTools, blockchain_tools_1.BlockchainTools, ipfs_tools_1.IpfsTools],
        exports: [tools_service_1.ToolsService, github_tools_1.GithubTools, web_tools_1.WebTools, blockchain_tools_1.BlockchainTools, ipfs_tools_1.IpfsTools],
    })
], ToolsModule);
//# sourceMappingURL=tools.module.js.map