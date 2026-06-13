import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AgentsModule } from './agents/agents.module';
import { IdeasModule } from './ideas/ideas.module';
import { RateLimitGuard, RATE_LIMITS } from './common/rate-limit.guard';
import { EncryptedWalletService } from './common/security.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: RATE_LIMITS.PUBLIC.ttl,
        limit: RATE_LIMITS.PUBLIC.limit,
        name: 'default',
      },
    ]),
    BlockchainModule,
    AgentsModule,
    IdeasModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    EncryptedWalletService,
  ],
})
export class AppModule {}