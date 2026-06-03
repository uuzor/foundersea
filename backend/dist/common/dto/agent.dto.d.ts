export declare class ScoreIdeaDto {
    ideaId: string;
    title: string;
    description: string;
    marketCategory: string;
    demoUrl?: string;
    repositoryUrl?: string;
    creatorAddress: string;
    fundingGoal: string;
    chain: string;
}
export declare class ValidateMilestoneDto {
    milestoneId: string;
    ideaId: string;
    builderAddress: string;
    repositoryUrl: string;
    demoUrl?: string;
    milestoneStartDate: string;
    expectedDeliverables: string;
    claimedCompletion: string;
    chain: string;
}
export declare class RankBuildersDto {
    ideaId: string;
    builderAddresses: string[];
    builderPortfolios: string[];
    chain: string;
}
