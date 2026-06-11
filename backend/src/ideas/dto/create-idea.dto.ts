export class CreateIdeaDto {
  title: string;
  description: string;
  image?: string;
  category?: string;
  creator?: string;
  softCap?: string; // in wei as string
  hardCap?: string; // in wei as string
  fundingGoal?: number;
  milestones?: any[];
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
