// Test Script for Groq LLM-Powered RAG Pipeline
const BASE = 'http://127.0.0.1:5000';
const H = { 'Content-Type': 'application/json' };

async function run() {
  console.log('====================================================');
  console.log('🚀 TESTING GROQ LLM-POWERED RAG PIPELINE');
  console.log('====================================================\n');

  const username = 'groq_tester_' + Math.random().toString(36).substring(2, 7);

  // 1. Signup & Seed Data
  console.log('Step 1: Creating test user and seeding 14 days of data...');
  await fetch(BASE + '/api/auth/signup', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username, email: `${username}@test.com`, password: 'password123', dob: '1990-01-01', sex: 'Male', name: 'Groq RAG Tester' })
  });

  await fetch(BASE + '/api/logs/seed', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username })
  });

  // 2. Trigger AI Review Generation
  console.log('Step 2: Triggering POST /api/plans/review (calling Groq Llama-3.3-70b)...');
  const startTime = Date.now();
  const res = await fetch(BASE + '/api/plans/review', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username, date: '2026-07-31' })
  });

  const duration = Date.now() - startTime;
  const data = await res.json();

  console.log(`\nResponse Status: ${res.status} (${duration}ms)`);
  console.log(`LLM Powered: ${data.llmPowered ? '✅ YES (Groq llama-3.3-70b-versatile)' : '⚠️ NO (Local Fallback)'}`);

  if (data.success) {
    console.log('\n--- FACTS (Extracted Stats) ---');
    (data.facts || []).forEach((f, i) => console.log(`  ${i+1}. ${f}`));

    console.log('\n--- INTERPRETATIONS (LLM Analytical Hypotheses) ---');
    (data.interpretations || []).forEach((interp, i) => console.log(`  ${i+1}. ${interp}`));

    console.log('\n--- RETROSPECTIVE TEXT (LLM Synthesized Narrative) ---');
    console.log(`  "${data.retrospectiveText}"`);

    console.log('\n--- PROPOSED RECOMMENDATIONS (Grounded in Knowledge Base) ---');
    (data.proposedRecommendations || []).forEach((rec, i) => {
      console.log(`\n  [Recommendation ${i+1}]`);
      console.log(`    Category:    ${rec.category}`);
      console.log(`    Proposal:    ${rec.proposal}`);
      console.log(`    Target Val:  ${rec.targetValue}`);
      console.log(`    KB Article:  ${rec.kbArticleId}`);
      console.log(`    Evidence:    ${rec.evidence}`);
    });

    console.log('\n====================================================');
    console.log('🏆 GROQ RAG PIPELINE TEST COMPLETE — SUCCESS!');
    console.log('====================================================');
  } else {
    console.error('❌ Test failed:', data.message);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('❌ Test runner crash:', err);
  process.exit(1);
});
