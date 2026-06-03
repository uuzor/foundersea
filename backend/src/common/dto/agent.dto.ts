import { IsString, IsOptional, IsUrl, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScoreIdeaDto {
  @ApiProperty({ description: 'Unique idea identifier' })
  @IsString()
  ideaId: string;

  @ApiProperty({ description: 'Idea title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Market category (e.g., DeFi, NFT, Gaming)' })
  @IsString()
  marketCategory: string;

  @ApiPropertyOptional({ description: 'Demo URL if available' })
  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @ApiPropertyOptional({ description: 'GitHub repository URL' })
  @IsOptional()
  @IsUrl()
  repositoryUrl?: string;

  @ApiProperty({ description: 'Creator wallet address' })
  @IsString()
  creatorAddress: string;

  @ApiProperty({ description: 'Funding goal amount' })
  @IsString()
  fundingGoal: string;

  @ApiProperty({ description: 'Target chain (robinhood, mantle, base)' })
  @IsString()
  chain: string;
}

export class ValidateMilestoneDto {
  @ApiProperty({ description: 'Unique milestone identifier' })
  @IsString()
  milestoneId: string;

  @ApiProperty({ description: 'Parent idea ID' })
  @IsString()
  ideaId: string;

  @ApiProperty({ description: 'Builder wallet address' })
  @IsString()
  builderAddress: string;

  @ApiProperty({ description: 'GitHub repository URL' })
  @IsUrl()
  repositoryUrl: string;

  @ApiPropertyOptional({ description: 'Demo URL if available' })
  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @ApiProperty({ description: 'Milestone start date (ISO 8601)' })
  @IsString()
  milestoneStartDate: string;

  @ApiProperty({ description: 'Expected deliverables' })
  @IsString()
  expectedDeliverables: string;

  @ApiProperty({ description: 'What builder claims to have completed' })
  @IsString()
  claimedCompletion: string;

  @ApiProperty({ description: 'Target chain (robinhood, mantle, base)' })
  @IsString()
  chain: string;
}

export class RankBuildersDto {
  @ApiProperty({ description: 'Parent idea ID' })
  @IsString()
  ideaId: string;

  @ApiProperty({ description: 'Builder wallet addresses' })
  @IsString({ each: true })
  builderAddresses: string[];

  @ApiProperty({ description: 'Builder GitHub portfolio URLs' })
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  builderPortfolios: string[];

  @ApiProperty({ description: 'Target chain (robinhood, mantle, base)' })
  @IsString()
  chain: string;
}