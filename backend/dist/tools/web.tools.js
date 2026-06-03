"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WebTools_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebTools = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
let WebTools = WebTools_1 = class WebTools {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(WebTools_1.name);
        this.serperUrl = 'https://google.serper.dev/search';
    }
    async search(query, purpose) {
        const apiKey = this.configService.serperApiKey;
        if (!apiKey) {
            throw new Error('Serper API key not configured');
        }
        try {
            const response = await fetch(this.serperUrl, {
                method: 'POST',
                headers: {
                    'X-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ q: query }),
            });
            if (!response.ok) {
                throw new Error(`Serper API error: ${response.status}`);
            }
            const data = await response.json();
            const results = (data.organic || []).slice(0, 10).map((item) => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
            }));
            return {
                query,
                purpose,
                results,
                totalResults: results.length,
            };
        }
        catch (error) {
            this.logger.error(`Failed to search: ${query}`, error);
            throw error;
        }
    }
    async fetchUrl(url, checkType) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'FounderSea/1.0',
                    'Accept': 'text/html,application/json',
                },
                signal: AbortSignal.timeout(10000),
            });
            const contentType = response.headers.get('content-type') || 'unknown';
            let content = '';
            if (contentType.includes('text/html')) {
                const html = await response.text();
                content = html
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 10000);
            }
            else if (contentType.includes('application/json')) {
                const json = await response.json();
                content = JSON.stringify(json).substring(0, 10000);
            }
            else {
                content = await response.text();
            }
            const result = {
                url,
                status: response.status,
                content: content.substring(0, 5000),
                contentType,
                isAvailable: response.ok,
            };
            if (checkType === 'content_match' && result.isAvailable) {
                result.matchedContent = [];
            }
            return result;
        }
        catch (error) {
            this.logger.error(`Failed to fetch URL: ${url}`, error);
            return {
                url,
                status: 0,
                content: '',
                contentType: 'error',
                isAvailable: false,
            };
        }
    }
};
exports.WebTools = WebTools;
exports.WebTools = WebTools = WebTools_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], WebTools);
//# sourceMappingURL=web.tools.js.map