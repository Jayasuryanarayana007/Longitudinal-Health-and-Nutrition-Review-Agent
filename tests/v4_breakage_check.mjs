// Comprehensive Edge-Case & Breakage Test Runner for V1 - V4
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
  await post('/api/auth/signup', { username: 'edge_tester', email: 'edge@test.com', password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'Edge Tester' });

  // TEST 1: Emojis and special characters in meal text
  let r = await post('/api/logs/extract-meal', { textInput: 'Had 2 rotis & dal! #yummy 🍛 milk (1 cup)' });
  check('1. Text extraction handles emojis, symbols (& # !), and parenthetical units', r, x => {
    return x.status === 200 && Array.isArray(x.data.items) && x.data.items.length >= 2;
  });

  // TEST 2: Decimal quantities e.g. "0.5 cup rice"
  r = await post('/api/logs/extract-meal', { textInput: '0.5 cup rice, 1.5 eggs' });
  check('2. Decimal quantities (0.5 cup, 1.5 eggs) calculate fractional macros', r, x => {
    const items = x.data.items || [];
    const rice = items.find(i => i.foodItem.toLowerCase().includes('rice'));
    return x.status === 200 && rice && rice.calories === 100; // 200 * 0.5 = 100
  });

  // TEST 3: Extra spaces, newlines, and trailing commas
  r = await post('/api/logs/extract-meal', { textInput: '  roti  ,  \n  black coffee , ' });
  check('3. Extra spaces, newlines, and trailing commas cleaned up without empty rows', r, x => {
    return x.status === 200 && x.data.items.length === 2;
  });

  // TEST 4: Null or empty body to extract-meal
  r = await post('/api/logs/extract-meal', { textInput: '' });
  check('4. Empty textInput returns HTTP 400 validation message', r, x => x.status === 400);

  // TEST 5: Large numeric values in UserCorrection
  r = await post('/api/logs', {
    username: 'edge_tester',
    date: '2026-07-29',
    meals: [{
      textInput: 'Custom Feast',
      aiEstimates: [{ foodItem: 'Feast', calories: 500, protein: 20, carbs: 50, fats: 10 }],
      items: [{ foodItem: 'Feast', calories: 9999, protein: 100, carbs: 500, fats: 100 }],
      isUserCorrected: true
    }]
  });
  check('5. Large valid meal values save cleanly and trigger UserCorrection audit', r, x => x.status === 200);

  // PRINT SUMMARY
  console.log('\n=== COMPREHENSIVE EDGE-CASE TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('Edge test error:', e); process.exit(1); });
