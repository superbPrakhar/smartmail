/**
 * SmartMail — Gemini LLM Service Tests
 * Run: node tests/geminiLLMTests.js
 */

require('dotenv').config();
const geminiLLMService = require('../services/geminiLLMService');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('  SmartMail Gemini AI Integration Tests');
  console.log('========================================\n');

  // Test 1: Status
  console.log('Test 1: Service status check');
  const status = await geminiLLMService.getStatus();
  assert(status.provider === 'gemini', 'Provider should be gemini');
  assert(status.model.includes('gemini'), 'Default model should be a gemini model');
  console.log('  ✅ PASS: Provider is gemini');
  console.log(`  ✅ PASS: Default model is ${status.model}`);
  console.log(`  ℹ️  Status: ${JSON.stringify(status)}\n`);

  // Test 2: Missing API Key Handling
  console.log('\nTest 2: Missing API key handling');
  const origKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  
  const resultNoKey = await geminiLLMService.analyzeEmail({
    subject: 'Test email',
    sender: 'test@example.com',
    body: 'Test body'
  });
  
  assert(resultNoKey.success === false, 'Returns success=false when API key missing');
  assert(resultNoKey.error.includes('GEMINI_API_KEY'), 'Returns informative error about missing API key');
  
  process.env.GEMINI_API_KEY = origKey;

  // Test 3: Standard Email Summarization (if API key is present)
  if (origKey && origKey.length > 5) {
    console.log('\nTest 3: Real Gemini API call with structured output');
    const result = await geminiLLMService.analyzeEmail({
      subject: 'URGENT: Project Status Meeting Tomorrow',
      sender: 'manager@techcorp.com',
      body: 'Hi team, please be prepared for our quarterly project status meeting tomorrow at 10 AM EST. Attendance is mandatory.'
    });

    assert(result.success === true, 'Gemini API returned success');
    assert(typeof result.data.summary === 'string' && result.data.summary.length > 0, 'Summary is a non-empty string');
    assert(typeof result.data.action_required === 'boolean', 'action_required is a boolean');
    assert(Array.isArray(result.data.important_points), 'important_points is an array');
    console.log(`  📄 Gemini Summary: "${result.data.summary}"`);
    console.log(`  ⚡ Action Required: ${result.data.action_required}`);
    console.log(`  📅 Deadline: ${result.data.deadline}`);
  } else {
    console.log('\nTest 3: Skipping live Gemini API call (no GEMINI_API_KEY configured in backend/.env)');
  }

  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
