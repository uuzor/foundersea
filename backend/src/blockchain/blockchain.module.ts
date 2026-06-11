import { Module } from '@nestjs/common';
import { ContractService } from './contract.service';
import { DeploymentService } from './deployment.service';
import { WalletService } from './wallet.service';
import { AppConfigModule } from '../config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [ContractService, DeploymentService, WalletService],
  exports: [ContractService, DeploymentService, WalletService],
})
export class BlockchainModule {}
