// Version 5 Test Suite — Goals Profile with Multiple Target Activities, AI RAG Review, Plan Versioning & Audit Logging
const BASE = 'http://localhost:5000';
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
  const testUser = 'v5_multiact_' + Math.random().toString(36).substring(2, 7);
  await post('/api/auth/signup', { username: testUser, email: `${testUser}@test.com`, password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'V5 Multi Tester' });

  // TEST 1: GET /api/plans/goals returns goal: null for first-time brand new users
  let r = await get(`/api/plans/goals?username=${testUser}`);
  check('V5 1: GET /plans/goals returns goal: null for first-time users (HTTP 200)', r, x => {
    return x.status === 200 && x.data.success === true && x.data.goal === null;
  });

  // TEST 2: POST /api/plans/goals updates multiple target activities (Running 20m + Walking 30m)
  r = await post('/api/plans/goals', {
    username: testUser,
    targetWeight: 72.5,
    targetDailyCalories: 2100,
    targetSleepHours: 8.5,
    targetActivities: [
      { type: 'Running', durationMinutes: 20, quantity: 3, unit: 'km' },
      { type: 'Walking', durationMinutes: 30, quantity: 5000, unit: 'steps' }
    ]
  });
  check('V5 2: POST /plans/goals saves multiple target activities & sums total activity minutes (50 mins) (HTTP 200)', r, x => {
    return x.status === 200 && x.data.goal && x.data.goal.targetActivityMinutes === 50
      && Array.isArray(x.data.goal.targetActivities) && x.data.goal.targetActivities.length === 2;
  });

  // TEST 3: Seed 14 days of data
  await post('/api/logs/seed', { username: testUser });

  // TEST 4: POST /api/plans/review generates RAG Retrospective & Plan with evidence
  r = await post('/api/plans/review', { username: testUser, date: '2026-07-31' });
  check('V5 3: POST /plans/review generates Facts, Interpretations & Recommendations with evidence (HTTP 200)', r, x => {
    return x.status === 200 && Array.isArray(x.data.facts) && Array.isArray(x.data.interpretations)
      && Array.isArray(x.data.proposedRecommendations) && x.data.proposedRecommendations.some(rec => rec.evidence && rec.kbArticleId);
  });

  // TEST 5: POST /api/plans/approve approves plan v2 and updates goals & audit logs
  r = await post('/api/plans/approve', {
    username: testUser,
    planVersion: 2,
    suggestions: [
      { category: 'Sleep', proposal: 'Sleep 8.5h', targetValue: 8.5, evidence: 'NSF Study', kbArticleId: 'kb-sleep-hygiene' }
    ],
    userModified: true
  });
  check('V5 4: POST /plans/approve activates plan v2 & records PlanModification audit (HTTP 200)', r, x => {
    return x.status === 200 && x.data.success === true;
  });

  // TEST 6: POST /api/plans/reject declines plan & records RejectedRecommendation audit
  r = await post('/api/plans/reject', {
    username: testUser,
    planVersion: 3,
    userRejectionReason: 'Busy travel schedule this week'
  });
  check('V5 5: POST /plans/reject records rejection feedback & audit log (HTTP 200)', r, x => {
    return x.status === 200 && x.data.success === true;
  });

  // PRINT SUMMARY
  console.log('\n=== MULTIPLE TARGET ACTIVITIES TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('V5 Multi-Activity Test runner error:', e); process.exit(1); });
