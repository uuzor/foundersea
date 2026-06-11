"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentsModule = void 0;
const common_1 = require("@nestjs/common");
const agent_service_1 = require("./agent.service");
const agents_controller_1 = require("./agents.controller");
const agents_service_1 = require("./agents.service");
const idea_scorer_agent_1 = require("./idea-scorer.agent");
const milestone_validator_agent_1 = require("./milestone-validator.agent");
const builder_ranker_agent_1 = require("./builder-ranker.agent");
const blockchain_module_1 = require("../blockchain/blockchain.module");
const tools_module_1 = require("../tools/tools.module");
let AgentsModule = class AgentsModule {
};
exports.AgentsModule = AgentsModule;
exports.AgentsModule = AgentsModule = __decorate([
    (0, common_1.Module)({
        imports: [blockchain_module_1.BlockchainModule, tools_module_1.ToolsModule],
        controllers: [agents_controller_1.AgentsController],
        providers: [agent_service_1.AgentService, agents_service_1.AgentsService, idea_scorer_agent_1.IdeaScorerAgent, milestone_validator_agent_1.MilestoneValidatorAgent, builder_ranker_agent_1.BuilderRankerAgent],
        exports: [agent_service_1.AgentService, agents_service_1.AgentsService],
    })
], AgentsModule);
//# sourceMappingURL=agents.module.js.map