// Master Breakage & Test Suite Runner for V1 - V6
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  { name: 'V1 & V2 Core API & Auth Suite', file: 'api_tests.mjs' },
  { name: 'V3 Validation Engine & Inconsistency Rules Suite', file: 'v3_extensive_tests.mjs' },
  { name: 'V4 Text Meal Extractor & Corrections Suite', file: 'v4_tests.mjs' },
  { name: 'V4 Edge-Case & Emojis Breakage Suite', file: 'v4_breakage_check.mjs' },
  { name: 'V5 Goals Profile, RAG Review & Plan Versioning Suite', file: 'v5_tests.mjs' },
  { name: 'V5 Deep Edge-Case Breakage Suite', file: 'v5_breakage_check.mjs' },
  { name: 'V6 Medical Refusal, Audit Logs & Failure Simulators Suite', file: 'v6_tests.mjs' }
];

console.log('====================================================');
console.log('🚀 MASTER BREAKAGE & REGRESSION TEST RUNNER (V1 - V6)');
console.log('====================================================\n');

let totalPassedSuites = 0;
let totalFailedSuites = 0;

suites.forEach((suite, index) => {
  const filePath = path.join(__dirname, suite.file);
  console.log(`[Suite ${index + 1}/${suites.length}] Running: ${suite.name}...`);
  try {
    const output = execSync(`node "${filePath}"`, { encoding: 'utf8' });
    console.log(output);
    console.log(`✅ [PASS] ${suite.name} completed successfully.\n----------------------------------------------------`);
    totalPassedSuites++;
  } catch (err) {
    console.error(`❌ [FAIL] ${suite.name} failed!`);
    console.error(err.stdout || err.message);
    totalFailedSuites++;
  }
});

console.log('====================================================');
console.log(`🏆 MASTER AUDIT SUMMARY: ${totalPassedSuites} / ${suites.length} Suites Passed`);
console.log('====================================================');

if (totalFailedSuites > 0) {
  process.exit(1);
}
