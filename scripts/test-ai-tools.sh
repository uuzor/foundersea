#!/bin/bash
# Test script to verify AI can use tools via TokenRouter agentic loop
# 
# Prerequisites:
# 1. Set TOKENROUTER_API_KEY environment variable
# 2. Start the backend server: cd backend && npm run start:dev
# 3. Run this script from the project root

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"

echo "=============================================="
echo "Testing AI Tool Usage via TokenRouter"
echo "=============================================="

# Check if backend is running
echo ""
echo "1. Checking backend health..."
if curl -s -f "${BACKEND_URL}/health" > /dev/null 2>&1; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend not running. Start it with: cd backend && npm run start:dev"
    echo "   Or run tests against deployed server by setting BACKEND_URL"
    exit 1
fi

# Get available tools
echo ""
echo "2. Getting available tools..."
TOOLS=$(curl -s "${BACKEND_URL}/agents/tools")
echo "   Available tools:"
echo "$TOOLS" | jq -r '.tools[] | "   - " + .name + ": " + .description'

# Get current stats
echo ""
echo "3. Current decision statistics..."
STATS=$(curl -s "${BACKEND_URL}/agents/stats")
echo "   Total decisions: $(echo $STATS | jq -r '.totalDecisions')"
echo "   On-chain decisions: $(echo $STATS | jq -r '.onChainCount')"

# Test the agentic idea scoring
echo ""
echo "4. Testing agentic idea scoring..."
curl -s -X POST "${BACKEND_URL}/agents/agentic/score-idea" \
  -H "Content-Type: application/json" \
  -d '{
    "ideaId": "test-idea-001",
    "title": "AI-Powered GitHub Analysis Tool",
    "description": "Analyzes GitHub repositories using AI to provide investment insights for Web3 projects",
    "marketCategory": "Developer Tools",
    "chain": "mantle"
  }' | jq .

echo ""
echo "=============================================="
echo "Test Summary"
echo "=============================================="
echo ""
echo "To test with real TokenRouter API:"
echo "   1. Set environment variable: export TOKENROUTER_API_KEY=your-key"
echo "   2. Restart backend: cd backend && npm run start:dev"
echo "   3. Run this script again"
echo ""
echo "The agentic loop should:"
echo "   - Call web_search to research market size"
echo "   - Call github_get_repo to verify the repo"
echo "   - Make a decision based on tool results"
echo "   - Record the decision on-chain via AgentIdentity"
echo ""
echo "Check agentic loop logs in backend for tool call traces."
echo "=============================================="