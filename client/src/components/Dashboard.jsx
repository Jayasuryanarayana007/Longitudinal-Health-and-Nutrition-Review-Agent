import React from 'react';
import { ShieldAlert, Calendar, TrendingDown, TrendingUp, Dumbbell, Coffee, BedDouble, Heart } from 'lucide-react';

export default function Dashboard({ weeklyStats, monthlyStats, activeGoal, logs }) {
  const weekly = weeklyStats || { avgSleep: 0, avgWeight: 0, weightChange: 0, avgMood: 0, avgEnergy: 0, totalActivityMins: 0, avgCalories: 0, daysLogged: 0, missingDays: [] };
  const monthly = monthlyStats || { avgSleep: 0, avgWeight: 0, weightChange: 0, avgMood: 0, avgEnergy: 0, totalActivityMins: 0, avgCalories: 0, daysLogged: 0, missingDays: [] };

  // Generate SVG Line Chart for Weight
  const renderWeightChart = () => {
    const weightLogs = logs.filter(l => l.weight).slice(-7); // Last 7 logged days
    if (weightLogs.length < 2) {
      return <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Need at least 2 logs to show weight trend</div>;
    }

    const width = 500;
    const height = 180;
    const padding = 25;

    const weights = weightLogs.map(l => l.weight);
    const minW = Math.min(...weights) - 0.5;
    const maxW = Math.max(...weights) + 0.5;
    const rangeW = maxW - minW || 1;

    const points = weightLogs.map((log, index) => {
      const x = padding + (index * (width - 2 * padding)) / (weightLogs.length - 1);
      const y = height - padding - ((log.weight - minW) * (height - 2 * padding)) / rangeW;
      return { x, y, weight: log.weight, date: log.date };
    });

    const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((r, i) => {
          const y = padding + r * (height - 2 * padding);
          const weightLabel = (maxW - r * rangeW).toFixed(1);
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
              <text x={padding - 5} y={y + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end">{weightLabel}</text>
            </g>
          );
        })}

        {/* The trend line */}
        <path d={pathD} fill="none" stroke="var(--color-secondary)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-base)" stroke="var(--color-secondary)" strokeWidth="2" />
            <text x={p.x} y={p.y - 8} fill="var(--text-primary)" fontSize="8" fontWeight="600" textAnchor="middle">{p.weight}kg</text>
            <text x={p.x} y={height - 5} fill="var(--text-muted)" fontSize="7" textAnchor="middle">{p.date.substr(5)}</text>
          </g>
        ))}
      </svg>
    );
  };

  // Generate SVG Bar Chart for Calories vs Activity
  const renderCalActChart = () => {
    const activeLogs = logs.slice(-7); // Last 7 logged days
    if (activeLogs.length === 0) {
      return <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data available</div>;
    }

    const width = 500;
    const height = 180;
    const padding = 25;
    const barWidth = 24;

    const data = activeLogs.map(log => {
      const cSum = (log.meals || []).reduce((s, m) => {
        const items = m.correctedEstimates || [];
        return s + items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
      }, 0);
      const aSum = (log.activities || []).reduce((s, a) => s + (a.durationMinutes || 0), 0);
      return { date: log.date, calories: cSum, activity: aSum };
    });

    const maxCal = Math.max(...data.map(d => d.calories), 2500); // Scale relative to max calories (min 2500)

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        {/* Grid lines */}
        {[0, 0.5, 1].map((r, i) => {
          const y = padding + r * (height - 2 * padding);
          const calLabel = Math.round(maxCal - r * maxCal);
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.05)" />
              <text x={padding - 5} y={y + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end">{calLabel}</text>
            </g>
          );
        })}

        {/* Render Bars */}
        {data.map((d, index) => {
          const x = padding + (index * (width - 2 * padding)) / (data.length) + 15;
          const calH = (d.calories / maxCal) * (height - 2 * padding);
          const yCal = height - padding - calH;

          // Activity line points
          const actH = Math.min((d.activity / 120) * (height - 2 * padding), height - 2 * padding); // Max 120 mins scale
          const yAct = height - padding - actH;

          return (
            <g key={index}>
              {/* Calorie Bar */}
              <rect x={x - barWidth / 2} y={yCal} width={barWidth} height={calH} fill="var(--color-primary-glow)" stroke="var(--color-primary)" strokeWidth="1" rx="2" />
              <text x={x} y={yCal - 4} fill="var(--color-primary)" fontSize="7" fontWeight="600" textAnchor="middle">{d.calories}</text>

              {/* Activity Dot */}
              <circle cx={x} cy={yAct} r="3.5" fill="var(--color-secondary)" />
              {d.activity > 0 && <text x={x} y={yAct - 6} fill="var(--color-secondary)" fontSize="7" textAnchor="middle">{d.activity}m</text>}

              {/* Date Label */}
              <text x={x} y={height - 5} fill="var(--text-muted)" fontSize="7" textAnchor="middle">{d.date.substr(5)}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Wellness Dashboard</h1>
        <p>Deterministic health data tracking and aggregate indicators.</p>
      </div>

      {/* Missing Data / Inconsistency Alerts */}
      {weekly.missingDays && weekly.missingDays.length > 0 && (
        <div className="alert-banner" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
          <ShieldAlert size={20} style={{ color: 'var(--color-warning)' }} />
          <div>
            <strong style={{ color: 'var(--color-warning)', fontSize: '0.9rem' }}>Missing Records Found</strong>
            <p style={{ fontSize: '0.8rem', marginTop: '0.1rem' }}>
              You have not logged health data for: {weekly.missingDays.slice(0, 4).join(', ')}
              {weekly.missingDays.length > 4 ? ` and ${weekly.missingDays.length - 4} other days.` : '.'} Please log daily metrics under the Logger tab.
            </p>
          </div>
        </div>
      )}

      {/* Summary Averages Row */}
      <div className="grid-cols-4">
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-primary)' }}>
            <BedDouble size={24} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Sleep</label>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{weekly.avgSleep}h</h3>
            <span style={{ fontSize: '0.75rem', color: weekly.avgSleep >= activeGoal.targetSleepHours ? 'var(--color-primary)' : 'var(--color-warning)' }}>
              Target: {activeGoal.targetSleepHours}h
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(6, 182, 212, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-secondary)' }}>
            <Coffee size={24} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Calories</label>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{weekly.avgCalories} kcal</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Target: {activeGoal.targetDailyCalories}
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent)' }}>
            <Dumbbell size={24} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Activity</label>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{Math.round(weekly.totalActivityMins / (weekly.daysLogged || 1))}m/d</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Total: {weekly.totalActivityMins} mins
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-alert)' }}>
            <Heart size={24} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weight Change</label>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {weekly.weightChange > 0 ? <TrendingUp size={20} style={{ color: 'var(--color-alert)' }} /> : <TrendingDown size={20} style={{ color: 'var(--color-primary)' }} />}
              {Math.abs(weekly.weightChange)}kg
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Current Avg: {weekly.avgWeight}kg
            </span>
          </div>
        </div>
      </div>

      {/* Visual Charts Layout */}
      <div className="grid-cols-2">
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Weight Trends</h3>
              <p style={{ fontSize: '0.8rem' }}>Chronological fluctuation over the last 7 logged days.</p>
            </div>
            <span className="badge badge-success">7 Logged Days</span>
          </div>
          <div style={{ height: '200px', width: '100%', padding: '0.5rem 0' }}>
            {renderWeightChart()}
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Calories & Exercise</h3>
              <p style={{ fontSize: '0.8rem' }}>Calorie intake (bars) vs active minutes (dots) weekly.</p>
            </div>
            <span className="badge badge-success">Active Tracking</span>
          </div>
          <div style={{ height: '200px', width: '100%', padding: '0.5rem 0' }}>
            {renderCalActChart()}
          </div>
        </div>
      </div>

      {/* Numerical Data Summary Table */}
      <div className="glass-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Longitudinal Data Aggregates</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Time Range</th>
                <th style={{ padding: '0.75rem 1rem' }}>Days Logged</th>
                <th style={{ padding: '0.75rem 1rem' }}>Avg Sleep</th>
                <th style={{ padding: '0.75rem 1rem' }}>Avg Calories</th>
                <th style={{ padding: '0.75rem 1rem' }}>Total Activity</th>
                <th style={{ padding: '0.75rem 1rem' }}>Avg Mood</th>
                <th style={{ padding: '0.75rem 1rem' }}>Avg Energy</th>
                <th style={{ padding: '0.75rem 1rem' }}>Weight Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '1rem', fontWeight: '600' }}>Weekly (7 Days)</td>
                <td style={{ padding: '1rem' }}>{weekly.daysLogged} days</td>
                <td style={{ padding: '1rem' }}>{weekly.avgSleep} hrs</td>
                <td style={{ padding: '1rem' }}>{weekly.avgCalories} kcal</td>
                <td style={{ padding: '1rem' }}>{weekly.totalActivityMins} mins</td>
                <td style={{ padding: '1rem' }}>{weekly.avgMood}/10</td>
                <td style={{ padding: '1rem' }}>{weekly.avgEnergy}/10</td>
                <td style={{ padding: '1rem', color: weekly.weightChange > 0 ? 'var(--color-alert)' : 'var(--color-primary)' }}>
                  {weekly.weightChange > 0 ? `+${weekly.weightChange}` : weekly.weightChange}kg
                </td>
              </tr>
              <tr>
                <td style={{ padding: '1rem', fontWeight: '600' }}>Monthly (30 Days)</td>
                <td style={{ padding: '1rem' }}>{monthly.daysLogged} days</td>
                <td style={{ padding: '1rem' }}>{monthly.avgSleep} hrs</td>
                <td style={{ padding: '1rem' }}>{monthly.avgCalories} kcal</td>
                <td style={{ padding: '1rem' }}>{monthly.totalActivityMins} mins</td>
                <td style={{ padding: '1rem' }}>{monthly.avgMood}/10</td>
                <td style={{ padding: '1rem' }}>{monthly.avgEnergy}/10</td>
                <td style={{ padding: '1rem', color: monthly.weightChange > 0 ? 'var(--color-alert)' : 'var(--color-primary)' }}>
                  {monthly.weightChange > 0 ? `+${monthly.weightChange}` : monthly.weightChange}kg
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
