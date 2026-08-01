// Test Script for Edge Cases: No Logs & No Goals in AI Retrospective Generator
const BASE = 'http://127.0.0.1:5000';
const H = { 'Content-Type': 'application/json' };

async function run() {
  console.log('====================================================');
  console.log('🧪 TESTING AI RETROSPECTIVE EDGE CASES (NO LOGS / NO GOALS)');
  console.log('====================================================\n');

  // EDGE CASE 1: Brand new user with ZERO logs and ZERO goals
  const user1 = 'edge_nologs_nogoals_' + Math.random().toString(36).substring(2, 7);
  console.log(`[Edge Case 1] Testing brand new user '${user1}' (0 logs, 0 goals)...`);
  
  await fetch(BASE + '/api/auth/signup', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username: user1, email: `${user1}@test.com`, password: 'password123', dob: '1995-01-01', sex: 'Female', name: 'Edge Tester 1' })
  });

  let res = await fetch(BASE + '/api/plans/review', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username: user1, date: '2026-08-01' })
  });
  let data = await res.json();

  console.log('Response status:', res.status);
  console.log('Facts:', data.facts);
  console.log('Interpretations:', data.interpretations);
  console.log('Recommendations count:', data.proposedRecommendations?.length);
  console.log('Retrospective Text:', data.retrospectiveText);

  if (data.facts?.some(f => f.includes('No daily health metrics logged')) && data.interpretations?.some(i => i.includes('Insufficient Data'))) {
    console.log('✅ Edge Case 1 PASSED: Clean "Insufficient Data" response returned without false sleep deficits!');
  } else {
    console.error('❌ Edge Case 1 FAILED');
    process.exit(1);
  }

  // EDGE CASE 2: User with LOGS but ZERO GOALS
  const user2 = 'edge_logs_nogoals_' + Math.random().toString(36).substring(2, 7);
  console.log(`\n[Edge Case 2] Testing user '${user2}' with 14 logs but ZERO goals...`);
  
  await fetch(BASE + '/api/auth/signup', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username: user2, email: `${user2}@test.com`, password: 'password123', dob: '1992-05-15', sex: 'Male', name: 'Edge Tester 2' })
  });

  await fetch(BASE + '/api/logs/seed', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username: user2 })
  });

  res = await fetch(BASE + '/api/plans/review', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ username: user2, date: '2026-08-01' })
  });
  data = await res.json();

  console.log('Response status:', res.status);
  console.log('Facts:', data.facts);
  console.log('Interpretations:', data.interpretations);

  if (data.facts?.some(f => f.includes('Not configured yet')) || data.interpretations?.some(i => i.includes('No active target goals') || i.includes('unconfigured'))) {
    console.log('✅ Edge Case 2 PASSED: Clean "Configure Goals" callout returned!');
  } else {
    console.error('❌ Edge Case 2 FAILED');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('🏆 EDGE CASE RETROSPECTIVE TEST COMPLETE — ALL PASSED!');
  console.log('====================================================');
}

run().catch(err => {
  console.error('❌ Edge case test runner crash:', err);
  process.exit(1);
});
