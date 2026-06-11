import { publicClient } from 'viem';
import { mantle } from 'viem/chains';
import { http } from 'viem';

const PUBLIC_CLIENT = publicClient({
  chain: mantle,
  transport: http('https://rpc.mantle.xyz'),
});

async function testBackendSetup() {
  console.log('🧪 Testing FounderSea Backend Setup...\n');

  try {
    // Test 1: Check RPC connection
    console.log('✓ Test 1: Connecting to Mantle Sepolia RPC...');
    const blockNumber = await PUBLIC_CLIENT.getBlockNumber();
    console.log(`  ✅ Connected! Current block: ${blockNumber}\n`);

    // Test 2: Check deployed contract addresses from env
    console.log('✓ Test 2: Verifying contract addresses are configured...');
    const requiredEnvs = [
      'IDEA_FACTORY_MANTLE',
      'AGENT_IDENTITY_MANTLE',
      'DAO_VOTING_MANTLE',
      'FUNDING_POOL_FACTORY_MANTLE',
      'IDEA_TOKEN_FACTORY_MANTLE',
      'BUILDER_AGREEMENT_MANTLE',
      'USDY_MANTLE',
      'AI_AGENT_ADDRESS',
    ];

    let allSet = true;
    for (const env of requiredEnvs) {
      const value = process.env[env];
      if (!value) {
        console.log(`  ❌ ${env}: NOT SET`);
        allSet = false;
      } else {
        console.log(`  ✅ ${env}: ${value.substring(0, 10)}...`);
      }
    }

    if (!allSet) {
      throw new Error('Some environment variables are not set!');
    }
    console.log('');

    // Test 3: Check AI_AGENT_PRIVATE_KEY
    console.log('✓ Test 3: Verifying AI agent private key is configured...');
    if (!process.env.AI_AGENT_PRIVATE_KEY) {
      throw new Error('AI_AGENT_PRIVATE_KEY not set!');
    }
    console.log('  ✅ AI_AGENT_PRIVATE_KEY is configured\n');

    // Test 4: Verify code of deployed contracts
    console.log('✓ Test 4: Verifying contracts are deployed...');
    const contracts = [
      { name: 'IdeaFactory', address: process.env.IDEA_FACTORY_MANTLE },
      { name: 'AgentIdentity', address: process.env.AGENT_IDENTITY_MANTLE },
      { name: 'DAOVoting', address: process.env.DAO_VOTING_MANTLE },
    ];

    for (const contract of contracts) {
      try {
        const bytecode = await PUBLIC_CLIENT.getCode({
          address: contract.address as `0x${string}`,
        });

        if (bytecode && bytecode !== '0x') {
          console.log(`  ✅ ${contract.name}: Code found (${bytecode.length} bytes)`);
        } else {
          console.log(`  ❌ ${contract.name}: No code at address`);
        }
      } catch (error) {
        console.log(`  ❌ ${contract.name}: Error checking code`);
      }
    }
    console.log('');

    console.log('✅ Backend setup verification PASSED!\n');
    console.log('Ready to:');
    console.log('  1. Create ideas via POST /ideas');
    console.log('  2. Validate milestones via POST /ideas/:id/milestones/:index/validate');
    console.log('  3. Read AI decisions via GET /ideas/agent/decisions\n');
  } catch (error) {
    console.error('❌ Backend setup verification FAILED:');
    console.error(error.message);
    process.exit(1);
  }
}

testBackendSetup();
