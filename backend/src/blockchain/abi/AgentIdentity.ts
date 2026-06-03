/**
 * AgentIdentity Contract ABI
 * Used for calling recordDecision on-chain from the backend
 */
export const AgentIdentityABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "agentId", "type": "uint256" },
      { "indexed": true, "name": "decisionType", "type": "uint8" },
      { "indexed": true, "name": "subjectId", "type": "uint256" },
      { "name": "confidence", "type": "uint256" }
    ],
    "name": "DecisionRecorded",
    "type": "event"
  },
  {
    "inputs": [
      { "name": "decisionType", "type": "uint8" },
      { "name": "subjectId", "type": "uint256" },
      { "name": "inputHash", "type": "bytes32" },
      { "name": "outputHash", "type": "bytes32" },
      { "name": "confidence", "type": "uint256" },
      { "name": "reasoningIpfsHash", "type": "string" }
    ],
    "name": "recordDecision",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalDecisions",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "data", "type": "bytes" }],
    "name": "hashInput",
    "outputs": [{ "name": "", "type": "bytes32" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "agentId",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "index", "type": "uint256" }],
    "name": "getDecision",
    "outputs": [
      {
        "components": [
          { "name": "timestamp", "type": "uint256" },
          { "name": "decisionType", "type": "uint8" },
          { "name": "subjectId", "type": "uint256" },
          { "name": "inputHash", "type": "bytes32" },
          { "name": "outputHash", "type": "bytes32" },
          { "name": "confidence", "type": "uint256" },
          { "name": "reasoningIpfsHash", "type": "string" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Decision types matching AgentIdentity contract
 */
export enum DecisionType {
  IDEA_APPROVE = 0,
  IDEA_REJECT = 1,
  IDEA_RANK = 2,
  BUILDER_RANK = 3,
  MVP_VALIDATE = 4,
  MILESTONE_VALIDATE = 5,
  DAO_VOTE = 6,
  REVENUE_ADVICE = 7
}