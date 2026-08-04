// Version 4 Test Suite — Text Extraction, Dual Input Modes & Correction Audit Logging
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

function check(name, result, passFn) {
  const pass = passFn(result);
  tests.push({ name, status: result.status, pass, msg: result.data.message || JSON.stringify(result.data).substring(0, 100) });
}

async function run() {
  // Ensure test user exists
  await post('/api/auth/signup', { username: 'v4_tester', email: 'v4@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'V4 Tester' });

  // TEST 1: POST /api/logs/extract-meal with text "Had 2 Rotis with Dal Makhani and Black Coffee"
  let r = await post('/api/logs/extract-meal', { textInput: 'Had 2 Rotis with Dal Makhani and Black Coffee' });
  check('V4 1: Text extraction returns parsed food items array (HTTP 200)', r, x => {
    return x.status === 200 && x.data.success === true && Array.isArray(x.data.items) && x.data.items.length >= 2;
  });

  // TEST 2: Multipliers check (2 Rotis calories should be ~240 kcal)
  const items = r.data.items || [];
  const rotiItem = items.find(i => i.foodItem.toLowerCase().includes('roti') || i.foodItem.toLowerCase().includes('chapati'));
  check('V4 2: Quantity multiplier parses 2x Rotis (~240 kcal)', { status: 200, data: rotiItem || {} }, x => {
    return rotiItem && rotiItem.calories >= 200 && rotiItem.quantity === 2;
  });

  // TEST 3: Ambiguous text input flags isAiUncertain = true
  r = await post('/api/logs/extract-meal', { textInput: 'some random unmapped snack' });
  check('V4 3: Ambiguous input flags isAiUncertain = true', r, x => {
    return x.status === 200 && x.data.isAiUncertain === true;
  });

  // TEST 4: Submit daily log with isUserCorrected = true & isAiUncertain = true
  r = await post('/api/logs', {
    username: 'v4_tester',
    date: '2026-07-30',
    weight: 71.0,
    sleepHours: 7.5,
    moodScore: 8,
    energyScore: 8,
    meals: [
      {
        textInput: 'Had 2 Rotis and Dal Makhani',
        aiEstimates: [{ foodItem: 'Roti', calories: 240, protein: 7, carbs: 44, fats: 4 }],
        items: [{ foodItem: 'Roti (Customized)', calories: 300, protein: 8, carbs: 50, fats: 5 }],
        isUserCorrected: true,
        isAiUncertain: false
      },
      {
        textInput: 'Ambiguous snack',
        items: [{ foodItem: 'Snack', calories: 150, protein: 2, carbs: 20, fats: 5 }],
        isUserCorrected: false,
        isAiUncertain: true
      }
    ]
  });
  check('V4 4: Log submission with UserCorrection and AIUncertainty succeeds (HTTP 200)', r, x => {
    return x.status === 200 && x.data.success === true;
  });

  // PRINT SUMMARY
  console.log('\n=== VERSION 4 TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('V4 Test runner error:', e); process.exit(1); });
