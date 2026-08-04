// Comprehensive Breakage Test Suite v2 — 22 tests
const BASE = 'http://127.0.0.1:5000';
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
  // ===== AUTH TESTS =====
  let r = await post('/api/auth/signup', { username: 'grill_user', email: 'grill@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'Grill Tester' });
  check('Signup valid user', r, x => x.status === 201 || x.data.message?.includes('already'));

  r = await post('/api/auth/signup', { username: 'grill_user', email: 'grill2@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'Dupe' });
  check('Signup duplicate username rejected', r, x => x.status === 400);

  r = await post('/api/auth/signup', { username: 'grill_user2', email: 'grill@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'Dupe Email' });
  check('Signup duplicate email rejected', r, x => x.status === 400);

  r = await post('/api/auth/login', { username: 'grill_user', password: 'securepass123' });
  check('Login valid credentials', r, x => x.status === 200 && x.data.success === true && x.data.user?.username === 'grill_user');

  r = await post('/api/auth/login', { username: 'grill_user', password: 'wrongpass' });
  check('Login wrong password rejected', r, x => x.status === 401);

  r = await post('/api/auth/signup', { username: 'bad_email', email: 'notanemail', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'Bad' });
  check('Signup invalid email rejected', r, x => x.status === 400);

  r = await post('/api/auth/signup', { username: 'short_pw', email: 'sp@test.com', password: '123', dob: '1995-06-15', sex: 'Male', name: 'Short' });
  check('Signup short password rejected', r, x => x.status === 400);

  r = await post('/api/auth/signup', { username: 'ab', email: 'ab@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'Short User' });
  check('Signup short username (<3 chars) rejected', r, x => x.status === 400);

  r = await post('/api/auth/signup', { username: 'future_dob', email: 'fdob@test.com', password: 'securepass123', dob: '2099-01-01', sex: 'Male', name: 'Future DOB' });
  check('Signup future DOB rejected', r, x => x.status === 400);

  // ===== LOG VALIDATION TESTS =====
  r = await post('/api/logs', { date: '2025-01-01' });
  check('Log missing username rejected', r, x => x.status === 400);

  r = await post('/api/logs', { username: 'grill_user', date: '2099-01-01', weight: 70 });
  check('Log future date rejected', r, x => x.status === 400);

  r = await post('/api/logs', { username: 'grill_user', date: '2026-07-29', weight: -5 });
  check('Log negative weight rejected', r, x => x.status === 400);

  r = await post('/api/logs', { username: 'grill_user', date: '2026-07-29', sleepHours: 25 });
  check('Log sleep > 24h rejected', r, x => x.status === 400);

  r = await post('/api/logs', { username: 'grill_user', date: '2026-07-29', moodScore: 11 });
  check('Log mood > 10 rejected', r, x => x.status === 400);

  r = await post('/api/logs', { username: 'grill_user', date: '2026-07-27', activities: [{ type: 'Running', durationMinutes: 30, quantity: -10, unit: 'km' }] });
  check('Activity negative quantity rejected', r, x => x.status === 400);

  // ===== LOG HAPPY PATH =====
  r = await post('/api/logs', {
    username: 'grill_user', date: '2026-07-30', weight: 72.5, height: 175, sleepHours: 7.5, moodScore: 8, energyScore: 7,
    meals: [{ textInput: 'Lunch', items: [{ foodItem: 'Rice', calories: 300, protein: 6, carbs: 65, fats: 1 }] }],
    activities: [{ type: 'Walking', durationMinutes: 30, quantity: 5000, unit: 'steps', intensity: 'Low' }]
  });
  check('Log valid full entry with meals+activities', r, x => x.status === 200 && x.data.success === true);

  r = await post('/api/logs', { username: 'grill_user', date: '2026-07-30', weight: 73, height: 175, sleepHours: 8, moodScore: 9, energyScore: 8 });
  check('Log upsert same date (update)', r, x => x.status === 200 && x.data.success === true);

  // ===== FALSY-ZERO EDGE CASE =====
  r = await post('/api/logs', { username: 'grill_user', date: '2026-07-28', sleepHours: 0, moodScore: 5, energyScore: 3 });
  check('Log sleepHours=0 accepted (falsy-zero fix)', r, x => x.status === 200 && x.data.success === true);

  // ===== SEED: 3 consecutive runs (the bug that was just fixed) =====
  for (let run = 1; run <= 3; run++) {
    r = await post('/api/logs/seed', { username: 'grill_user' });
    check(`Seed run ${run}/3 (idempotent)`, r, x => x.status === 200 && x.data.success === true);
  }

  // ===== SUMMARIES =====
  r = await get('/api/logs/summaries?username=grill_user&date=2026-07-31');
  check('Summaries returns weekly+monthly data', r, x => {
    return x.status === 200 && x.data.weekly && x.data.monthly
      && x.data.weekly.sleepAvg > 0 && x.data.monthly.caloriesAvg > 0
      && x.data.weekly.workoutSummaries.length > 0;
  });

  r = await get('/api/logs/summaries');
  check('Summaries missing params rejected', r, x => x.status === 400);

  // ===== PRINT RESULTS =====
  console.log('\n=== COMPREHENSIVE BREAKAGE TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} (HTTP ${t.status}) — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('Test runner error:', e); process.exit(1); });
