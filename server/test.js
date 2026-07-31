import assert from 'assert';

// Mock validate function simulating server-side validation rules
function validateLogPayload({ sleepHours, weight, moodScore, energyScore, yesterdayWeight, totalCalories, highIntensityActivity }) {
  const errors = [];

  // Data Quality checks
  if (sleepHours < 0 || sleepHours > 24) {
    errors.push('Sleep duration must be between 0 and 24 hours.');
  }
  if (sleepHours < 4.0 || sleepHours > 12.0) {
    errors.push('Sleep duration Warning: Logging sleep below 4 hours or above 12 hours is blocked for profile safety.');
  }
  if (weight < 30.0 || weight > 300.0) {
    errors.push('Weight must be between 30kg and 300kg.');
  }
  if (yesterdayWeight) {
    const weightDiff = Math.abs(weight - yesterdayWeight);
    if (weightDiff > 3.0) {
      errors.push(`Weight Discrepancy: Logged weight differs from yesterday by ${weightDiff.toFixed(1)}kg.`);
    }
  }
  if (moodScore < 1 || moodScore > 10 || energyScore < 1 || energyScore > 10) {
    errors.push('Mood and energy scores must be between 1 and 10.');
  }

  // Inconsistency checks
  if (sleepHours < 4.5 && energyScore >= 9) {
    errors.push('Paradoxical Energy: You reported high energy despite low sleep.');
  }
  if (totalCalories < 0 || totalCalories > 10000) {
    errors.push('Total calories must be between 0 and 10,000 kcal.');
  }
  if (highIntensityActivity > 120 && totalCalories < 1000) {
    errors.push('Extreme Calorie Deficit: High active output with low calorie intake.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Mock stats function simulating deterministic calculation logic
function calculateAverages(logs) {
  if (logs.length === 0) return { avgSleep: 0, avgCalories: 0, totalActivity: 0 };
  
  const totalSleep = logs.reduce((sum, l) => sum + l.sleepHours, 0);
  const totalCalories = logs.reduce((sum, l) => sum + l.calories, 0);
  const totalActivity = logs.reduce((sum, l) => sum + l.activityMinutes, 0);
  
  return {
    avgSleep: Number((totalSleep / logs.length).toFixed(1)),
    avgCalories: Number((totalCalories / logs.length).toFixed(0)),
    totalActivity
  };
}

// --- RUN TESTS ---
console.log('🚀 Running Unit Tests for Wellness Review Agent...');

try {
  // Test 1: Valid log passes validation
  const validResult = validateLogPayload({
    sleepHours: 7.5,
    weight: 70.0,
    moodScore: 8,
    energyScore: 7,
    yesterdayWeight: 70.2,
    totalCalories: 2000,
    highIntensityActivity: 30
  });
  assert.strictEqual(validResult.valid, true);
  console.log('✅ Test 1: Valid payload validation passed.');

  // Test 2: Low sleep boundary validation
  const invalidSleepResult = validateLogPayload({
    sleepHours: 3.5,
    weight: 70.0,
    moodScore: 8,
    energyScore: 7,
    yesterdayWeight: 70.2,
    totalCalories: 2000,
    highIntensityActivity: 30
  });
  assert.strictEqual(invalidSleepResult.valid, false);
  assert.ok(invalidSleepResult.errors[0].includes('Sleep duration Warning'));
  console.log('✅ Test 2: Sleep hours bounds check passed.');

  // Test 3: Weight fluctuation validation
  const invalidWeightResult = validateLogPayload({
    sleepHours: 8.0,
    weight: 75.0,
    moodScore: 8,
    energyScore: 7,
    yesterdayWeight: 70.0, // 5kg change
    totalCalories: 2000,
    highIntensityActivity: 30
  });
  assert.strictEqual(invalidWeightResult.valid, false);
  assert.ok(invalidWeightResult.errors[0].includes('Weight Discrepancy'));
  console.log('✅ Test 3: Weight fluctuation checks passed.');

  // Test 4: Low sleep vs high energy inconsistency
  const paradoxicalEnergyResult = validateLogPayload({
    sleepHours: 4.2, // Low sleep
    weight: 70.0,
    moodScore: 8,
    energyScore: 9, // High energy
    yesterdayWeight: 70.0,
    totalCalories: 2000,
    highIntensityActivity: 30
  });
  assert.strictEqual(paradoxicalEnergyResult.valid, false);
  assert.ok(paradoxicalEnergyResult.errors[0].includes('Paradoxical Energy'));
  console.log('✅ Test 4: Sleep vs Energy Inconsistency anomaly caught.');

  // Test 5: High exercise vs low food intake inconsistency
  const calorieDeficitResult = validateLogPayload({
    sleepHours: 8.0,
    weight: 70.0,
    moodScore: 8,
    energyScore: 7,
    yesterdayWeight: 70.0,
    totalCalories: 800, // Low calories
    highIntensityActivity: 150 // High active mins
  });
  assert.strictEqual(calorieDeficitResult.valid, false);
  assert.ok(calorieDeficitResult.errors[0].includes('Extreme Calorie Deficit'));
  console.log('✅ Test 5: High activity vs low calories anomaly caught.');

  // Test 6: Deterministic stats calculator
  const mockLogs = [
    { sleepHours: 8.0, calories: 2000, activityMinutes: 30 },
    { sleepHours: 7.0, calories: 2200, activityMinutes: 45 },
    { sleepHours: 6.0, calories: 1800, activityMinutes: 0 }
  ];
  const stats = calculateAverages(mockLogs);
  assert.strictEqual(stats.avgSleep, 7.0);
  assert.strictEqual(stats.avgCalories, 2000);
  assert.strictEqual(stats.totalActivity, 75);
  console.log('✅ Test 6: Deterministic summaries calculator matches aggregates.');

  console.log('\n🎉 All unit tests completed successfully!');

} catch (error) {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
}
