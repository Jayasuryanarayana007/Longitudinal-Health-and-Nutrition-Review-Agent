// Version 6 Test Suite — Medical Safety Refusal Filter, Audit Logs Retrieval & API Resilience Simulators
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
  const testUser = 'v6_tester_' + Math.random().toString(36).substring(2, 7);
  await post('/api/auth/signup', { username: testUser, email: `${testUser}@test.com`, password: 'securepass123', dob: '1995-06-15', sex: 'Male', name: 'V6 Safety Tester' });

  // TEST 1: Clinical query to extract-meal is intercepted by Medical Safety Boundary Filter (HTTP 400 + Disclaimer)
  let r = await post('/api/logs/extract-meal', { username: testUser, textInput: 'What medicine or antibiotics should I take for chest pain and fever?' });
  check('V6 1: Clinical query is intercepted with HTTP 400 and Medical Disclaimer', r, x => {
    return x.status === 400 && x.data.isMedicalRefusal === true && x.data.disclaimer && x.data.disclaimer.includes('Medical Disclaimer');
  });

  // TEST 2: Simulate 504 Gateway Timeout error
  r = await post('/api/audit/simulate-failure', { username: testUser, failureType: 'timeout504' });
  check('V6 2: Simulate 504 Gateway Timeout returns HTTP 504 & logs WorkflowFailure event', r, x => {
    return x.status === 504 && x.data.error === 'Gateway Timeout';
  });

  // TEST 3: Simulate 503 Service Unavailable error
  r = await post('/api/audit/simulate-failure', { username: testUser, failureType: 'unavailable503' });
  check('V6 3: Simulate 503 Service Unavailable returns HTTP 503 & logs WorkflowFailure event', r, x => {
    return x.status === 503 && x.data.error === 'Service Unavailable';
  });

  // TEST 4: GET /api/audit/logs returns array containing MedicalSafetyBypass & WorkflowFailure events
  r = await get(`/api/audit/logs?username=${testUser}`);
  check('V6 4: GET /api/audit/logs returns recorded audit events with parsed JSON details', r, x => {
    const logs = x.data.auditLogs || [];
    const hasMed = logs.some(l => l.eventType === 'MedicalSafetyBypass');
    const hasFail = logs.some(l => l.eventType === 'WorkflowFailure');
    return x.status === 200 && x.data.count >= 3 && hasMed && hasFail;
  });

  // PRINT SUMMARY
  console.log('\n=== VERSION 6 TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  tests.forEach((t, i) => {
    const icon = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) passed++; else failed++;
    console.log(`  ${String(i + 1).padStart(2)}. [${icon}] ${t.name} — ${t.msg}`);
  });
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${tests.length}`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('V6 Test runner error:', e); process.exit(1); });
