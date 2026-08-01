// Extensive V3 Breakage Test Runner (30 Test Cases)
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
  // Ensure test users exist
  await post('/api/auth/signup', { username: 'v3_audit_1', email: 'v3a1@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'User 1' });
  await post('/api/auth/signup', { username: 'v3_audit_2', email: 'v3a2@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Female', name: 'User 2' });

  // ===== CATEGORY 1: RULE 1 — SLEEP VS ENERGY PARADOX =====
  // 1.1 Sleep = 2.9h, Energy = 9 -> BLOCK 400
  let r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-30', sleepHours: 2.9, energyScore: 9 });
  check('1.1 Sleep 2.9h & Energy 9 is BLOCKED', r, x => x.status === 400 && x.data.message.includes('Paradoxical Energy'));

  // 1.2 Sleep = 0h, Energy = 10 -> BLOCK 400
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-30', sleepHours: 0, energyScore: 10 });
  check('1.2 Sleep 0h & Energy 10 is BLOCKED', r, x => x.status === 400 && x.data.message.includes('Paradoxical Energy'));

  // 1.3 Sleep = 3.0h, Energy = 9 -> ALLOW 200 (boundary edge: < 3h is blocked, 3.0h is allowed)
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-30', sleepHours: 3.0, energyScore: 9 });
  check('1.3 Sleep 3.0h & Energy 9 is ALLOWED (Boundary Edge)', r, x => x.status === 200 && x.data.success === true);

  // 1.4 Sleep = 2.5h, Energy = 8 -> ALLOW 200 (energy < 9 is allowed even if sleep < 3h)
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-29', sleepHours: 2.5, energyScore: 8 });
  check('1.4 Sleep 2.5h & Energy 8 is ALLOWED (Energy < 9)', r, x => x.status === 200 && x.data.success === true);

  // ===== CATEGORY 2: RULE 2 — EXTREME CALORIE DEFICIT =====
  // 2.1 Active = 125m, Calories = 800 -> BLOCK 400
  r = await post('/api/logs', {
    username: 'v3_audit_1', date: '2026-07-28',
    activities: [{ type: 'Running', durationMinutes: 125 }],
    meals: [{ textInput: 'Salad', items: [{ foodItem: 'Greens', calories: 800 }] }]
  });
  check('2.1 Active 125m & Calories 800 is BLOCKED', r, x => x.status === 400 && x.data.message.includes('Extreme Calorie Deficit'));

  // 2.2 Active = 120m, Calories = 800 -> ALLOW 200 (boundary edge: > 120m is blocked, 120m is allowed)
  r = await post('/api/logs', {
    username: 'v3_audit_1', date: '2026-07-28',
    activities: [{ type: 'Running', durationMinutes: 120 }],
    meals: [{ textInput: 'Salad', items: [{ foodItem: 'Greens', calories: 800 }] }]
  });
  check('2.2 Active 120m & Calories 800 is ALLOWED (Boundary Edge)', r, x => x.status === 200 && x.data.success === true);

  // 2.3 Active = 150m, Calories = 1200 -> ALLOW 200 (Calories >= 1000 is allowed)
  r = await post('/api/logs', {
    username: 'v3_audit_1', date: '2026-07-27',
    activities: [{ type: 'Running', durationMinutes: 150 }],
    meals: [{ textInput: 'Pasta', items: [{ foodItem: 'Noodles', calories: 1200 }] }]
  });
  check('2.3 Active 150m & Calories 1200 is ALLOWED', r, x => x.status === 200 && x.data.success === true);

  // ===== CATEGORY 3: BOUNDARY QUALITY CHECKS =====
  // 3.1 Weight < 30 kg -> BLOCK 400
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-26', weight: 29.9 });
  check('3.1 Weight 29.9 kg is BLOCKED (<30kg)', r, x => x.status === 400);

  // 3.2 Weight > 300 kg -> BLOCK 400
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-26', weight: 300.1 });
  check('3.2 Weight 300.1 kg is BLOCKED (>300kg)', r, x => x.status === 400);

  // 3.3 Height < 50 cm -> BLOCK 400
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-26', height: 49 });
  check('3.3 Height 49 cm is BLOCKED (<50cm)', r, x => x.status === 400);

  // 3.4 Height > 250 cm -> BLOCK 400
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-26', height: 251 });
  check('3.4 Height 251 cm is BLOCKED (>250cm)', r, x => x.status === 400);

  // 3.5 Mood < 1 -> BLOCK 400
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-26', moodScore: 0 });
  check('3.5 Mood 0 is BLOCKED (<1)', r, x => x.status === 400);

  // 3.6 Mood > 10 -> BLOCK 400
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-26', moodScore: 11 });
  check('3.6 Mood 11 is BLOCKED (>10)', r, x => x.status === 400);

  // ===== CATEGORY 4: RULE 3 — 24H WEIGHT JUMP WARNING =====
  await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-24', weight: 75.0 });
  r = await post('/api/logs', { username: 'v3_audit_1', date: '2026-07-25', weight: 79.5 });
  check('4.1 24h Weight Jump +4.5kg returns warning (HTTP 200)', r, x => x.status === 200 && x.data.warnings?.some(w => w.includes('24h Weight Shift')));

  // ===== CATEGORY 5: MISSING DAYS SCANNER & SUMMARIES =====
  // Seed 14 days for v3_audit_2
  await post('/api/logs/seed', { username: 'v3_audit_2' });
  const todayStr = new Date().toISOString().split('T')[0];
  r = await get(`/api/logs/summaries?username=v3_audit_2&date=${todayStr}`);
  check('5.1 Summaries returns missingDays array', r, x => x.status === 200 && Array.isArray(x.data.missingDays));
  check('5.2 Summaries returns dailyHistory array with 14+ items', r, x => x.status === 200 && Array.isArray(x.data.dailyHistory) && x.data.dailyHistory.length >= 14);

  // Verify dailyHistory structure for SVG charts
  const sampleEntry = r.data.dailyHistory ? r.data.dailyHistory[0] : null;
  check('5.3 dailyHistory item has required chart keys (weight, sleepHours, calories, activityMinutes)', { status: 200, data: sampleEntry || {} }, x => {
    return sampleEntry && ('weight' in sampleEntry) && ('sleepHours' in sampleEntry) && ('calories' in sampleEntry) && ('activityMinutes' in sampleEntry);
  });

  // ===== PRINT SUMMARY =====
  console.log('\n=== V3 EXTENSIVE BREAKAGE TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('Extensive test runner error:', e); process.exit(1); });
