// Version 3 Test Suite — Validation Engine, Inconsistency Rules & SVG Chart Data
const BASE = 'http://localhost:5000';
const H = { 'Content-Type': 'application/json' };
const tests = [];

async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const d = await r.json();
  return { status: r.status, data: d };
}

async function get(path) {
  const r = await fetch(BASE + path);
  const d = await r.json();
  return { status: r.status, data: d };
}

function check(name, result, passFn) {
  const pass = passFn(result);
  tests.push({ name, status: result.status, pass, msg: result.data.message || JSON.stringify(result.data).substring(0, 100) });
}

async function run() {
  // Ensure test user exists
  await post('/api/auth/signup', { username: 'v3_tester', email: 'v3@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'V3 Tester' });

  // TEST 1: Sleep < 3h AND Energy >= 9 (Sleep vs Energy Paradox -> BLOCKING 400)
  let r = await post('/api/logs', {
    username: 'v3_tester',
    date: '2026-07-30',
    sleepHours: 2.5,
    energyScore: 9,
    moodScore: 8
  });
  check('V3 Rule 1: Sleep < 3h & Energy >= 9 is BLOCKED (HTTP 400)', r, x => x.status === 400 && x.data.message.includes('Paradoxical Energy'));

  // TEST 2: Sleep = 3.5h AND Energy = 9 (Sleep >= 3h -> NOT BLOCKED)
  r = await post('/api/logs', {
    username: 'v3_tester',
    date: '2026-07-30',
    sleepHours: 3.5,
    energyScore: 9,
    moodScore: 8
  });
  check('V3 Rule 1 Edge: Sleep = 3.5h & Energy = 9 is ALLOWED (HTTP 200)', r, x => x.status === 200 && x.data.success === true);

  // TEST 3: Active Mins > 120m AND Calories < 1000 (Extreme Calorie Deficit -> BLOCKING 400)
  r = await post('/api/logs', {
    username: 'v3_tester',
    date: '2026-07-29',
    activities: [{ type: 'Cardio', durationMinutes: 130 }],
    meals: [{ textInput: 'Salad', items: [{ foodItem: 'Lettuce', calories: 200 }] }]
  });
  check('V3 Rule 2: Active > 120m & Calories < 1000 is BLOCKED (HTTP 400)', r, x => x.status === 400 && x.data.message.includes('Extreme Calorie Deficit'));

  // TEST 4: Weight Jump > 3.0kg (24h Weight Shift -> NON-BLOCKING WARNING)
  // First log initial weight
  await post('/api/logs', { username: 'v3_tester', date: '2026-07-27', weight: 70.0 });
  // Second log weight + 4kg
  r = await post('/api/logs', { username: 'v3_tester', date: '2026-07-28', weight: 74.5 });
  check('V3 Rule 3: 24h Weight Jump > 3kg triggers NON-BLOCKING warning (HTTP 200)', r, x => {
    return x.status === 200 && x.data.warnings && x.data.warnings.some(w => w.includes('24h Weight Shift'));
  });

  // TEST 5: Boundary Check - Weight < 30kg (BLOCKING 400)
  r = await post('/api/logs', { username: 'v3_tester', date: '2026-07-26', weight: 15 });
  check('V3 Boundary: Weight < 30kg is BLOCKED (HTTP 400)', r, x => x.status === 400);

  // TEST 6: Seed 14 days of data for v3_tester
  r = await post('/api/logs/seed', { username: 'v3_tester' });
  check('V3 Seed 14 days', r, x => x.status === 200 && x.data.success === true);

  // TEST 7: GET /summaries returns missingDays & dailyHistory array for SVG charts
  r = await get('/api/logs/summaries?username=v3_tester&date=2026-07-31');
  check('GET /summaries returns missingDays & dailyHistory for SVG charts', r, x => {
    return x.status === 200 && Array.isArray(x.data.missingDays) && Array.isArray(x.data.dailyHistory) && x.data.dailyHistory.length > 0;
  });

  // PRINT RESULTS
  console.log('\n=== VERSION 3 TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('V3 Test runner error:', e); process.exit(1); });
