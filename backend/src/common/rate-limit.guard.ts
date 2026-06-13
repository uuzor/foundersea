import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

/**
 * Rate limiting guard with custom IP extraction
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly logger = new Logger(RateLimitGuard.name);

  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    this.logger.warn('Rate limit exceeded');
    throw new ThrottlerException('Rate limit exceeded. Try again later.');
  }

  protected async getTracker(req: any): Promise<string> {
    const clientIP = 
      req.headers?.['x-forwarded-for']?.toString().split(',')[0] ||
      req.headers?.['x-real-ip']?.toString() ||
      req.socket?.remoteAddress ||
      'unknown';
    
    return clientIP;
  }
}

/**
 * Constants for rate limit configuration
 */
export const RATE_LIMITS = {
  // Public endpoints
  PUBLIC: {
    ttl: 60000, // 1 minute
    limit: 30,
  },
  
  // Read operations
  READ: {
    ttl: 60000,
    limit: 100,
  },
  
  // Write operations (create, update)
  WRITE: {
    ttl: 60000,
    limit: 10,
  },
  
  // Blockchain write operations (higher value, slower)
  BLOCKCHAIN_WRITE: {
    ttl: 60000,
    limit: 5,
  },
  
  // Authentication endpoints
  AUTH: {
    ttl: 300000, // 5 minutes
    limit: 5,
  },
  
  // Ideas/Agents endpoints (business logic)
  BUSINESS_LOGIC: {
    ttl: 60000,
    limit: 10,
  },
} as const;
