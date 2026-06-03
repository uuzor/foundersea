import { ConfigService } from '../config/config.service';
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}
export interface SearchResponse {
    query: string;
    purpose: string;
    results: SearchResult[];
    totalResults: number;
}
export interface UrlFetchResponse {
    url: string;
    status: number;
    content: string;
    contentType: string;
    isAvailable: boolean;
    matchedContent?: string[];
}
export declare class WebTools {
    private readonly configService;
    private readonly logger;
    private readonly serperUrl;
    constructor(configService: ConfigService);
    search(query: string, purpose: string): Promise<SearchResponse>;
    fetchUrl(url: string, checkType?: string): Promise<UrlFetchResponse>;
}
