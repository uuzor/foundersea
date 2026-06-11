import { AgentIdentityABI } from '../abi/AgentIdentity';

// Minimal ABIs used by backend. For speed, provide trimmed ABIs for methods we call.
export const ideaFactoryAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getIdea',
    inputs: [{ name: 'ideaId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'ideaToken', type: 'address' },
      { name: 'fundingPool', type: 'address' },
      { name: 'fundingGate', type: 'address' },
      { name: 'status', type: 'uint8' },
      { name: 'aiScore', type: 'uint256' },
      { name: 'approvalReasonHash', type: 'string' },
    ],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'nextIdeaId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
];
export const fundingPoolAbi = [
  'function raisedAmount() view returns (uint256)',
  'function softCap() view returns (uint256)',
  'function hardCap() view returns (uint256)',
  'function fundingClosed() view returns (bool)',
  'function builderAssigned() view returns (bool)',
  'function competitorsSet() view returns (bool)',
  'function getMilestoneCount() view returns (uint256)',
  'function setMilestoneValidated(uint256,uint256,string)'
];
export const agentIdentityAbi = AgentIdentityABI;
export const daoVotingAbi = ['function setIdeaToken(address)'];
export const ideaTokenFactoryAbi = ['function createIdeaToken(uint256,address,address,uint256,address,address)'];
export const fundingPoolFactoryAbi = ['function createFundingPool(uint256,address,address,uint256,uint256,uint256,address)'];
export const builderAgreementAbi = ['function createAgreement(uint256,address,address,address[],string)'];
export const ideaTokenAbi = ['function mint(address,uint256)', 'function balanceOf(address) view returns (uint256)'];
export const ideaMarketplaceAbi = ['event IdeaCreated(uint256,address,address,address)'];
