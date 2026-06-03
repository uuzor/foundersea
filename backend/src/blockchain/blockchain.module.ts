import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { WalletService } from './wallet.service';

@Module({
  providers: [BlockchainService, WalletService],
  exports: [BlockchainService, WalletService],
})
export class BlockchainModule {}