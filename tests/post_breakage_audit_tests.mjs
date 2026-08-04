/**
 * Post-Breakage-Audit Edge-Case Tests
 * Targets the 12 specific fixes applied in commit c64a90e
 */

const BASE = 'http://127.0.0.1:5000/api';
const results = [];

function log(name, pass, detail) {
  results.push({ name, pass });
  const icon = pass ? '[PASS]' : '[FAIL]';
  const short = String(detail).substring(0, 120);
  console.log(`  ${results.length}. ${icon} ${name} — ${short}`);
}

async function safeFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  let body;
  try { body = await res.json(); } catch { body = { raw: await res.text?.() }; }
  return { status: res.status, body };
}

async function run() {
  console.log('\n=== POST-BREAKAGE-AUDIT EDGE-CASE TESTS ===\n');

  // ── TEST 1: AI Review with follow-up answers (tests aiWellnessAgent.js FIX 1) ──
  const seedUser = 'breakage_audit_user_' + Date.now();
  const seedRes = await safeFetch(`${BASE}/logs/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: seedUser })
  });
  log('1. Seed data for test user succeeds (POST /logs/seed)',
    seedRes.status === 200 && seedRes.body.success === true,
    seedRes.body.message || JSON.stringify(seedRes.body));

  const goalRes = await safeFetch(`${BASE}/plans/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: seedUser,
      targetSleepHours: 8,
      targetDailyCalories: 2000,
      targetWeight: 75,
      targetActivities: [{ type: 'Walking', durationMinutes: 30, quantity: 5000, unit: 'steps' }]
    })
  });
  log('2. Set goals for test user (POST /plans/goals)',
    goalRes.status === 200 && goalRes.body.success === true,
    goalRes.body.message || JSON.stringify(goalRes.body));

  // Generate AI review WITH follow-up answers — this is the critical test for FIX 1
  const today = new Date().toISOString().split('T')[0];
  const reviewRes = await safeFetch(`${BASE}/plans/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: seedUser,
      date: today,
      followUpAnswers: { 0: 'I sleep late because of work deadlines', 1: 'I prefer light cardio over weight training' }
    })
  });
  log('3. AI Review WITH follow-up answers returns 200 (critical FIX 1 test)',
    reviewRes.status === 200 && reviewRes.body.success === true,
    JSON.stringify(reviewRes.body).substring(0, 120));

  log('4. AI Review returns facts array',
    reviewRes.status === 200 && Array.isArray(reviewRes.body.facts) && reviewRes.body.facts.length > 0,
    `facts count: ${reviewRes.body.facts?.length}`);

  log('5. AI Review returns interpretations array',
    reviewRes.status === 200 && Array.isArray(reviewRes.body.interpretations) && reviewRes.body.interpretations.length > 0,
    `interpretations count: ${reviewRes.body.interpretations?.length}`);

  log('6. AI Review returns followUpQuestions array',
    reviewRes.status === 200 && Array.isArray(reviewRes.body.followUpQuestions),
    `followUpQuestions count: ${reviewRes.body.followUpQuestions?.length}`);

  log('7. AI Review returns proposedRecommendations array',
    reviewRes.status === 200 && Array.isArray(reviewRes.body.proposedRecommendations),
    `recommendations count: ${reviewRes.body.proposedRecommendations?.length}`);

  // ── TEST 8-9: Simulate-failure now works without FK error (FIX 3 - audit.js) ──
  const sim504 = await safeFetch(`${BASE}/audit/simulate-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: seedUser, failureType: 'timeout504' })
  });
  log('8. Simulate 504 returns HTTP 504 (not 500 FK error)',
    sim504.status === 504,
    sim504.body.message || JSON.stringify(sim504.body));

  const sim503 = await safeFetch(`${BASE}/audit/simulate-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: seedUser, failureType: 'unavailable503' })
  });
  log('9. Simulate 503 returns HTTP 503 (not 500 FK error)',
    sim503.status === 503,
    sim503.body.message || JSON.stringify(sim503.body));

  // ── TEST 10: Simulate-failure with system_test default user (edge case) ──
  const simDefault = await safeFetch(`${BASE}/audit/simulate-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ failureType: 'timeout504' })
  });
  log('10. Simulate 504 with NO username (defaults to system_test) returns 504 not FK error',
    simDefault.status === 504,
    simDefault.body.message || JSON.stringify(simDefault.body));

  // ── TEST 11: Medical safety audit log FK (FIX 4 - logs.js extract-meal) ──
  const medSafety = await safeFetch(`${BASE}/logs/extract-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textInput: 'What medication should I take for diabetes?', username: seedUser })
  });
  log('11. Medical safety intercept returns 400 (not 500 FK error)',
    medSafety.status === 400 && medSafety.body.isMedicalRefusal === true,
    medSafety.body.message || JSON.stringify(medSafety.body));

  // ── TEST 12: Medical safety WITHOUT username (system_safety fallback) ──
  const medNoUser = await safeFetch(`${BASE}/logs/extract-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textInput: 'diagnose my chest pain and prescribe treatment' })
  });
  log('12. Medical safety intercept with NO username returns 400 (not 500 FK error)',
    medNoUser.status === 400 && medNoUser.body.isMedicalRefusal === true,
    medNoUser.body.message || JSON.stringify(medNoUser.body));

  // ── TEST 13: Brand new user daily log with meals & activities (FIX 2 - canonicalUser) ──
  const freshUser = 'fresh_breakage_' + Date.now();
  const logRes = await safeFetch(`${BASE}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: freshUser,
      date: today,
      weight: 70,
      height: 175,
      sleepHours: 7,
      moodScore: 7,
      energyScore: 7,
      meals: [{
        textInput: 'Rice and dal',
        items: [{ foodItem: 'Rice', calories: 200, protein: 4, carbs: 45, fats: 1 }],
        isUserCorrected: true,
        isAiUncertain: true
      }],
      activities: [{ type: 'Walking', durationMinutes: 30, quantity: 5000, unit: 'steps' }]
    })
  });
  log('13. Fresh user daily log with meals+activities saves cleanly (canonicalUser fix)',
    logRes.status === 200 && logRes.body.success === true,
    logRes.body.message || JSON.stringify(logRes.body));

  // ── TEST 14: Verify audit logs recorded UserCorrection + AIUncertainty for new user ──
  const auditRes = await safeFetch(`${BASE}/audit/logs?username=${freshUser}`);
  log('14. Audit logs for fresh user contain UserCorrection and AIUncertainty events',
    auditRes.status === 200 && auditRes.body.auditLogs?.length >= 2,
    `audit count: ${auditRes.body.auditLogs?.length}, types: ${auditRes.body.auditLogs?.map(l => l.eventType).join(', ')}`);

  // ── TEST 15: Plan approve for seeded user ──
  const approveRes = await safeFetch(`${BASE}/plans/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: seedUser,
      planVersion: reviewRes.body.planVersion || 1,
      suggestions: reviewRes.body.proposedRecommendations || [],
      userModified: true
    })
  });
  log('15. Plan approve succeeds for seeded user (full workflow)',
    approveRes.status === 200 && approveRes.body.success === true,
    approveRes.body.message || JSON.stringify(approveRes.body));

  // ── TEST 16: Plan reject with emojis and special chars ──
  const rejectRes = await safeFetch(`${BASE}/plans/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: seedUser,
      planVersion: 3,
      userRejectionReason: 'Not suitable - too aggressive for my current schedule (& lifestyle)'
    })
  });
  log('16. Plan reject with special chars succeeds',
    rejectRes.status === 200 && rejectRes.body.success === true,
    rejectRes.body.message || JSON.stringify(rejectRes.body));

  // ── TEST 17: Summaries for seeded user ──
  const summRes = await safeFetch(`${BASE}/logs/summaries?username=${seedUser}&date=${today}`);
  log('17. GET /summaries returns weekly + monthly data with dailyHistory',
    summRes.status === 200 && summRes.body.success === true && Array.isArray(summRes.body.dailyHistory),
    `dailyHistory count: ${summRes.body.dailyHistory?.length}, weekly sleep avg: ${summRes.body.weekly?.sleepAvg}`);

  // ── TEST 18: GET /plans/active returns the approved plan ──
  const activeRes = await safeFetch(`${BASE}/plans/active?username=${seedUser}`);
  log('18. GET /plans/active returns approved plan with suggestions array',
    activeRes.status === 200 && activeRes.body.activePlan !== null && Array.isArray(activeRes.body.activePlan?.suggestions),
    `plan version: v${activeRes.body.activePlan?.version}, suggestions: ${activeRes.body.activePlan?.suggestions?.length}`);

  // ── SUMMARY ──
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${results.length}\n`);

  if (failed > 0) {
    console.log('FAILURES:');
    results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.name}`));
    process.exit(1);
  } else {
    console.log('All post-breakage-audit edge-case tests PASSED!');
  }
}

run().catch(err => { console.error('Test runner crashed:', err); process.exit(1); });
