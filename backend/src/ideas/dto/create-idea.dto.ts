// Tranche state enum (matches contract)
export enum TrancheState {
  GENESIS = 0,  // Building started with creator deposit + protocol seed
  OPEN = 1,     // Public deposits accepted
  CLOSED = 2    // Hard cap hit or governance closed
}

export class CreateIdeaDto {
  title: string;
  description: string;
  image?: string;
  category?: string;
  creator?: string;
  hardCap?: string; // in wei as string - upper bound for fundraising
  milestones?: any[];
}

export class IdeaResponseDto {
  ideaId: bigint;
  creator: string;
  ideaToken: string;
  fundingPool: string;
  fundingGate: string;
  status: number;
  aiScore: number;
  approvalReasonHash: string;
  trancheState?: TrancheState; // Added for continuous commitment model
  raisedAmount?: string;
  hardCap?: string;
}

export class ApproveIdeaDto {
  ideaId: string;
  score: number;
  reasoning: string;
}

export class ValidateMilestoneDto {
  submissionContent: string;
  evidence?: string;
}

export class GetIdeaDto {
  ideaId: string;
}

export class ListIdeasDto {
  limit?: number;
  offset?: number;
}

// DTO for funding pool state
export class FundingPoolStateDto {
  trancheState: TrancheState;
  raisedAmount: string;
  hardCap: string;
  builderAssigned: boolean;
  competitorsSet: boolean;
  lastValidatedMilestone?: number;
}
