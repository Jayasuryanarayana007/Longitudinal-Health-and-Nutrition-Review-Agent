import { getDbConnection } from '../data/db.js';

/**
 * Validates numeric boundaries for single daily log attributes.
 * Returns null if valid, or an error string if out of bounds.
 */
export function validateLogBoundaries(logData) {
  const { weight, height, sleepHours, moodScore, energyScore } = logData;

  if (weight !== null && weight !== undefined && weight !== '') {
    const w = parseFloat(weight);
    if (isNaN(w) || w < 30 || w > 300) {
      return 'Weight must be a valid number between 30 kg and 300 kg.';
    }
  }

  if (height !== null && height !== undefined && height !== '') {
    const h = parseFloat(height);
    if (isNaN(h) || h < 50 || h > 250) {
      return 'Height must be a valid number between 50 cm and 250 cm.';
    }
  }

  if (sleepHours !== null && sleepHours !== undefined && sleepHours !== '') {
    const s = parseFloat(sleepHours);
    if (isNaN(s) || s < 0 || s > 24) {
      return 'Sleep duration must be between 0 and 24 hours.';
    }
  }

  if (moodScore !== null && moodScore !== undefined && moodScore !== '') {
    const m = parseInt(moodScore);
    if (isNaN(m) || m < 1 || m > 10) {
      return 'Mood score must be an integer between 1 and 10.';
    }
  }

  if (energyScore !== null && energyScore !== undefined && energyScore !== '') {
    const e = parseInt(energyScore);
    if (isNaN(e) || e < 1 || e > 10) {
      return 'Energy score must be an integer between 1 and 10.';
    }
  }

  return null;
}

/**
 * Evaluates smart cross-metric inconsistency rules.
 * Returns object containing { blockingError: string|null, warnings: string[] }
 */
export async function checkInconsistencies(userStr, logData) {
  const { date, sleepHours, energyScore, meals, activities, weight } = logData;
  const warnings = [];

  const sleepVal = (sleepHours !== null && sleepHours !== undefined && sleepHours !== '') ? parseFloat(sleepHours) : null;
  const energyVal = (energyScore !== null && energyScore !== undefined && energyScore !== '') ? parseInt(energyScore) : null;

  // RULE 1: Sleep vs. Energy Paradox (Sleep < 3h AND Energy >= 9) — BLOCKING
  if (sleepVal !== null && energyVal !== null) {
    if (sleepVal < 3.0 && energyVal >= 9) {
      return {
        blockingError: 'Paradoxical Energy Warning: Logged sleep duration is under 3 hours (<3h) but Energy Score is reported at 9 or higher (≥9). Please verify your entry before submitting.',
        warnings: []
      };
    }
  }

  // Calculate total meal calories
  let totalCalories = 0;
  if (meals && Array.isArray(meals)) {
    meals.forEach(m => {
      const items = m.items || [];
      items.forEach(item => {
        totalCalories += parseFloat(item.calories || 0);
      });
    });
  }

  // Calculate total workout duration
  let totalActivityMins = 0;
  if (activities && Array.isArray(activities)) {
    activities.forEach(act => {
      totalActivityMins += parseInt(act.durationMinutes || 0);
    });
  }

  // RULE 2: Extreme Calorie Deficit (Active mins > 120m AND Calories < 1000 kcal) — BLOCKING
  if (totalActivityMins > 120 && totalCalories > 0 && totalCalories < 1000) {
    return {
      blockingError: 'Extreme Calorie Deficit Warning: Total active workout duration exceeds 120 minutes while daily calorie intake is under 1000 kcal. Please verify your entries.',
      warnings: []
    };
  }

  // Query database for historical logs to evaluate trend-based warnings
  let db;
  try {
    db = await getDbConnection();

    // RULE 3: 24h Weight Jump Warning (> 3.0 kg shift vs previous log) — NON-BLOCKING
    if (weight !== null && weight !== undefined && weight !== '') {
      const currentWeight = parseFloat(weight);
      const prevLog = await db.get(
        `SELECT weight FROM daily_logs 
         WHERE username = ? AND date < ? AND weight IS NOT NULL 
         ORDER BY date DESC LIMIT 1`,
        [userStr, date]
      );

      if (prevLog && prevLog.weight) {
        const weightDiff = Math.abs(currentWeight - prevLog.weight);
        if (weightDiff > 3.0) {
          warnings.push(`24h Weight Shift Warning: Recorded weight (${currentWeight} kg) differs by >3.0 kg from previous entry (${prevLog.weight} kg). Check scale accuracy.`);
        }
      }
    }

    // RULE 4: High Calorie vs. Weight Loss Contrast — NON-BLOCKING
    const activeGoal = await db.get('SELECT targetDailyCalories FROM goals WHERE username = ? AND status = "Active"', [userStr]);
    if (activeGoal && activeGoal.targetDailyCalories) {
      const targetCals = activeGoal.targetDailyCalories;
      if (totalCalories > (targetCals + 1000)) {
        // Check 7-day weight drop
        const weekAgoDate = new Date(date);
        weekAgoDate.setDate(weekAgoDate.getDate() - 7);
        const weekAgoStr = weekAgoDate.toISOString().split('T')[0];

        const oldLog = await db.get(
          `SELECT weight FROM daily_logs WHERE username = ? AND date <= ? AND weight IS NOT NULL ORDER BY date DESC LIMIT 1`,
          [userStr, weekAgoStr]
        );

        if (oldLog && weight) {
          const delta = parseFloat(weight) - oldLog.weight;
          if (delta < -1.5) {
            warnings.push(`Measurement Discrepancy Warning: Daily calorie intake exceeds target by >1000 kcal, yet logged weight shows a drop of ${Math.abs(delta).toFixed(1)} kg over the past week.`);
          }
        }
      }
    }

  } catch (err) {
    console.error('Inconsistency engine DB query error:', err);
  } finally {
    if (db) await db.close();
  }

  return { blockingError: null, warnings };
}

/**
 * Scans the past 7 days prior to baseDate for missing log entries.
 * Returns array of missing YYYY-MM-DD date strings and formatted day labels.
 */
export async function detectMissingDays(username, baseDateStr) {
  let db;
  try {
    db = await getDbConnection();
    const baseDate = new Date(baseDateStr);

    const past7Dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      past7Dates.push(d.toISOString().split('T')[0]);
    }

    const placeholder = past7Dates.map(() => '?').join(',');
    const loggedRows = await db.all(
      `SELECT date FROM daily_logs WHERE username = ? AND date IN (${placeholder})`,
      [username, ...past7Dates]
    );

    const loggedSet = new Set(loggedRows.map(r => r.date));
    const missingDates = past7Dates.filter(d => !loggedSet.has(d));

    // Convert dates to friendly short labels (e.g., 'Tue (07/28)')
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const missingDaysFormatted = missingDates.map(dStr => {
      const parts = dStr.split('-');
      const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return `${dayNames[dObj.getDay()]} (${parts[1]}/${parts[2]})`;
    });

    return {
      missingDates,
      missingDaysFormatted
    };

  } catch (err) {
    console.error('Missing days detector error:', err);
    return { missingDates: [], missingDaysFormatted: [] };
  } finally {
    if (db) await db.close();
  }
}
