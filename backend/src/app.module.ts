import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from './agents/agents.module';
import { ToolsModule } from './tools/tools.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AgentsModule,
    ToolsModule,
    BlockchainModule,
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class AppModule {}