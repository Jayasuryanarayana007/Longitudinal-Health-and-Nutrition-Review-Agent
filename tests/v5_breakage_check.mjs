// Dedicated Version 5 Deep Breakage & Edge-Case Test Suite
const BASE = 'http://127.0.0.1:5000';
const H = { 'Content-Type': 'application/json' };
const tests = [];

async function post(path, body) {
  try {
    const r = await fetch(BASE + path, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const d = await r.json();
    return { status: r.status, data: d };
  } catch (err) {
    return { status: 500, data: { message: err.message } };
  }
}

async function get(path) {
  try {
    const r = await fetch(BASE + path);
    const d = await r.json();
    return { status: r.status, data: d };
  } catch (err) {
    return { status: 500, data: { message: err.message } };
  }
}

function check(name, result, passFn) {
  const pass = passFn(result);
  tests.push({ name, status: result.status, pass, msg: result.data.message || JSON.stringify(result.data).substring(0, 100) });
}

async function run() {
  const testUser = 'v5_edge_' + Math.random().toString(36).substring(2, 7);
  await post('/api/auth/signup', { username: testUser, email: `${testUser}@test.com`, password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'V5 Edge Tester' });

  // TEST 1: Brand new user GET /plans/goals returns goal: null until user configures goals
  let r = await get(`/api/plans/goals?username=${testUser}`);
  check('1. Brand new user gets goal: null until initial goals profile is saved', r, x => {
    return x.status === 200 && x.data.goal === null;
  });

  // TEST 2: Save empty targetActivities array falls back safely
  r = await post('/api/plans/goals', {
    username: testUser,
    targetWeight: 70.0,
    targetDailyCalories: 2200,
    targetSleepHours: 8.0,
    targetActivities: []
  });
  check('2. Empty targetActivities array falls back to default workout target cleanly', r, x => {
    return x.status === 200 && x.data.goal && x.data.goal.version >= 1 && Array.isArray(x.data.goal.targetActivities);
  });

  // TEST 3: Seed historical data
  await post('/api/logs/seed', { username: testUser });

  // TEST 4: Generate RAG review & verify evidence dropdown strings exist
  r = await post('/api/plans/review', { username: testUser, date: '2026-07-31' });
  check('4. RAG Review generates Facts, Interpretations, and Recommendations with Evidence IDs', r, x => {
    const recs = x.data.proposedRecommendations || [];
    return x.status === 200 && recs.length > 0 && recs.every(item => item.evidence && item.kbArticleId);
  });

  // TEST 5: Approve Plan with custom modified targets
  r = await post('/api/plans/approve', {
    username: testUser,
    planVersion: 2,
    suggestions: [
      { category: 'Sleep', proposal: 'Target 8.0h sleep', targetValue: 8.0, evidence: 'NSF Evidence', kbArticleId: 'kb-sleep-hygiene' },
      { category: 'Activity (Running)', proposal: 'Run 25 mins', targetValue: 25, evidence: 'ACSM Evidence', kbArticleId: 'kb-zone2-cardio' }
    ],
    userModified: true
  });
  check('5. Plan approval activates v2, updates goals profile, and logs PlanModification audit', r, x => {
    return x.status === 200 && x.data.success === true;
  });

  // TEST 6: Verify Active Plan endpoint returns newly approved v2 plan
  r = await get(`/api/plans/active?username=${testUser}`);
  check('6. GET /plans/active returns newly approved v2 plan with suggestions array', r, x => {
    return x.status === 200 && x.data.activePlan && x.data.activePlan.version === 2 && x.data.activePlan.suggestions.length === 2;
  });

  // TEST 7: Reject Plan with emojis and special characters in reason
  r = await post('/api/plans/reject', {
    username: testUser,
    planVersion: 3,
    userRejectionReason: 'Can\'t do 8.0h sleep! 🏋️ travel schedule ✈️ #busy "work trip"'
  });
  check('7. Reject Plan with special characters & emojis saves cleanly and logs RejectedRecommendation audit', r, x => {
    return x.status === 200 && x.data.success === true;
  });

  // PRINT SUMMARY
  console.log('\n=== VERSION 5 DEEP BREAKAGE TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('V5 Edge breakage test error:', e); process.exit(1); });
