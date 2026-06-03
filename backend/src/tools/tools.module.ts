import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { GithubTools } from './github.tools';
import { WebTools } from './web.tools';
import { BlockchainTools } from './blockchain.tools';
import { IpfsTools } from './ipfs.tools';

@Module({
  providers: [ToolsService, GithubTools, WebTools, BlockchainTools, IpfsTools],
  exports: [ToolsService, GithubTools, WebTools, BlockchainTools, IpfsTools],
})
export class ToolsModule {}