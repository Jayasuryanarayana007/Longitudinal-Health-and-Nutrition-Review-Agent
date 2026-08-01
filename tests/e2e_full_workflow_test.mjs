// Complete End-to-End User Workflow & Functionality Verification Script
const BASE = 'http://localhost:5000';
const H = { 'Content-Type': 'application/json' };
const stepResults = [];

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

function verify(featureName, result, checkFn) {
  const ok = checkFn(result);
  stepResults.push({ featureName, status: result.status, ok, msg: result.data.message || JSON.stringify(result.data).substring(0, 120) });
}

async function run() {
  const username = 'flow_' + Math.random().toString(36).substring(2, 7);

  // 1. AUTHENTICATION & PROFILE CREATION (V1)
  let r = await post('/api/auth/signup', { username, email: `${username}@test.com`, password: 'password123', dob: '1992-04-10', sex: 'Male', name: 'Flow Tester' });
  verify('1. User Signup & Account Creation [V1]', r, x => x.status === 201 && x.data.success === true);

  r = await post('/api/auth/login', { username, password: 'password123' });
  verify('2. User Login & Credentials Verification [V1]', r, x => x.status === 200 && x.data.user);

  // 2. GOALS PROFILE & MULTIPLE TARGET ACTIVITIES (V1 & V5)
  r = await get(`/api/plans/goals?username=${username}`);
  verify('3. Fetch Initial Goals Profile (returns goal: null for brand new users) [V1/V5]', r, x => x.status === 200 && x.data.goal === null);

  r = await post('/api/plans/goals', {
    username,
    targetWeight: 62.0,
    targetDailyCalories: 1900,
    targetSleepHours: 8.0,
    targetActivities: [
      { type: 'Running', durationMinutes: 25, quantity: 4, unit: 'km' },
      { type: 'Walking', durationMinutes: 35, quantity: 6000, unit: 'steps' }
    ]
  });
  verify('4. Customize Initial Goals & Multiple Target Activities (v1) [V5]', r, x => x.status === 200 && x.data.goal && x.data.goal.version === 1);

  // 3. TEXT MEAL EXTRACTION & MEDICAL SAFETY FILTER (V4 & V6)
  r = await post('/api/logs/extract-meal', { username, textInput: 'Had 2 Rotis with Dal Makhani and Black Coffee' });
  verify('5. REST API Text Meal Extraction (Open Food Facts) [V4]', r, x => x.status === 200 && Array.isArray(x.data.items) && x.data.items.length >= 2);

  r = await post('/api/logs/extract-meal', { username, textInput: 'What antibiotics should I take for chest pain?' });
  verify('6. Medical Refusal Safety Boundary Filter Interception [V6]', r, x => x.status === 400 && x.data.isMedicalRefusal === true);

  // 4. DATA LOGGING & DATA INTEGRITY ENGINE (V2 & V3)
  r = await post('/api/logs', {
    username,
    date: '2026-07-29',
    weight: 63.0,
    height: 165,
    sleepHours: 2.5,
    moodScore: 8,
    energyScore: 9, // Sleep < 3h & Energy >= 9 -> Paradoxical Block!
    meals: [],
    activities: []
  });
  verify('7. Paradoxical Sleep vs Energy Anomaly Block [V3]', r, x => x.status === 400 && (x.data.isBlocked === true || (x.data.message && x.data.message.includes('Paradoxical'))));

  // Seed 14 days of clean valid data
  await post('/api/logs/seed', { username });

  // 5. DETERMINISTIC SUMMARIES & SVG TREND CHARTS (V2 & V3)
  r = await get(`/api/logs/summaries?username=${username}&date=2026-07-31`);
  verify('8. Deterministic Summaries, Missing Gap Scanner & History Arrays [V2/V3]', r, x => x.status === 200 && x.data.weekly && x.data.dailyHistory);

  // 6. AI RETROSPECTIVE, RAG REVIEW & PLAN APPROVAL (V5)
  r = await post('/api/plans/review', { username, date: '2026-07-31' });
  verify('9. RAG Review Engine: Facts, Interpretations & Tailored Proposals [V5]', r, x => x.status === 200 && Array.isArray(x.data.facts) && Array.isArray(x.data.proposedRecommendations));

  const suggestions = r.data.proposedRecommendations || [];
  r = await post('/api/plans/approve', {
    username,
    planVersion: 2,
    suggestions,
    userModified: false
  });
  verify('10. Approve Plan (v2), Activate Protocol & Auto-Sync Goals [V5]', r, x => x.status === 200 && x.data.success === true);

  r = await get(`/api/plans/active?username=${username}`);
  verify('11. Fetch Today\'s Active Approved Plan Summary [V5]', r, x => x.status === 200 && x.data.activePlan && x.data.activePlan.version === 2);

  // 7. API RESILIENCE SIMULATORS & AUDIT LOGS CONTROL PANEL (V6)
  r = await post('/api/audit/simulate-failure', { username, failureType: 'timeout504' });
  verify('12. Simulate 504 Gateway Timeout Error [V6]', r, x => x.status === 504);

  r = await post('/api/audit/simulate-failure', { username, failureType: 'unavailable503' });
  verify('13. Simulate 503 Service Unavailable Error [V6]', r, x => x.status === 503);

  r = await get(`/api/audit/logs?username=${username}`);
  verify('14. Fetch Audit Logs Explorer Records (All Event Types) [V6]', r, x => x.status === 200 && x.data.count >= 3);

  // PRINT FINAL SUMMARY
  console.log('\n====================================================');
  console.log('🎉 END-TO-END FULL APPLICATION FUNCTIONALITY VERIFICATION');
  console.log('====================================================\n');
  let passed = 0, failed = 0;
  stepResults.forEach((s, i) => {
    const icon = s.ok ? 'PASS' : 'FAIL';
    if (s.ok) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${s.featureName}`);
  });
  console.log(`\n  Total System Functions Verified: ${passed} passed, ${failed} failed out of ${stepResults.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('E2E Test error:', e); process.exit(1); });
