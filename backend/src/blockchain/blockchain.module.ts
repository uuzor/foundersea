import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { DeploymentService } from './deployment.service';
import { WalletService } from './wallet.service';
import { AppConfigModule } from '../config/config.module';
import { EncryptedWalletService } from '../common/security.middleware';

@Module({
  imports: [AppConfigModule],
  providers: [ContractService, DeploymentService, WalletService, EncryptedWalletService],
  exports: [ContractService, DeploymentService, WalletService, EncryptedWalletService],
})
export class BlockchainModule {}
