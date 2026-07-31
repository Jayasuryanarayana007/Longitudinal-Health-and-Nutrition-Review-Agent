import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, Moon, Flame, Scale } from 'lucide-react';

/**
 * Single SVG Line Chart with gradient fill area and interactive hover tooltips.
 */
function SvgLineChart({ data, dataKey, label, unit, color = '#10b981', strokeWidth = 2.5 }) {
  const [activePoint, setActivePoint] = useState(null);

  if (!data || data.length === 0) {
    return <div className="chart-empty-state">No trend data available for selected period.</div>;
  }

  // Filter valid data points
  const validPoints = data.filter(d => d[dataKey] !== null && d[dataKey] !== undefined);
  if (validPoints.length === 0) {
    return <div className="chart-empty-state">No recorded {label.toLowerCase()} entries in this timeframe.</div>;
  }

  const values = validPoints.map(d => Number(d[dataKey]));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal === minVal ? 1 : maxVal - minVal;

  const width = 560;
  const height = 180;
  const paddingX = 45;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingTop - paddingBottom;

  // Calculate SVG points coordinates
  const points = validPoints.map((d, index) => {
    const x = paddingX + (index / Math.max(validPoints.length - 1, 1)) * chartW;
    const normY = (Number(d[dataKey]) - minVal) / valRange;
    const y = height - paddingBottom - normY * chartH;
    return { x, y, val: Number(d[dataKey]), date: d.date };
  });

  // Construct SVG Path String
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Area Fill Path String (closing down to baseline)
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  const gradientId = `grad_${dataKey}_${Math.random().toString(36).substring(2, 7)}`;

  // Calculate delta indicator
  const startVal = points[0].val;
  const endVal = points[points.length - 1].val;
  const delta = (endVal - startVal).toFixed(1);
  const deltaNum = Number(delta);

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>{label} Trend</span>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc', marginTop: '0.1rem' }}>
            {endVal} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>{unit}</span>
          </div>
        </div>
        
        {/* Delta Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.8rem',
          fontWeight: '600',
          padding: '0.3rem 0.6rem',
          borderRadius: '20px',
          background: deltaNum < 0 ? 'rgba(52, 211, 153, 0.15)' : deltaNum > 0 ? 'rgba(248, 113, 113, 0.15)' : 'rgba(148, 163, 184, 0.15)',
          color: deltaNum < 0 ? '#34d399' : deltaNum > 0 ? '#f87171' : '#94a3b8'
        }}>
          {deltaNum > 0 ? <TrendingUp size={14} /> : deltaNum < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
          <span>{deltaNum > 0 ? `+${delta}` : delta} {unit}</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%', overflow: 'visible' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingTop} x2={width - paddingX} y2={paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1={paddingX} y1={paddingTop + chartH / 2} x2={width - paddingX} y2={paddingTop + chartH / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} stroke="rgba(255,255,255,0.1)" />

          {/* Gradient Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Line Path */}
          <path d={pathD} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={activePoint && activePoint.date === p.date ? 6 : 4}
                fill={activePoint && activePoint.date === p.date ? '#ffffff' : color}
                stroke={color}
                strokeWidth={2}
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setActivePoint(p)}
                onMouseLeave={() => setActivePoint(null)}
              />

              {/* Date Labels (Show first, middle, last) */}
              {(idx === 0 || idx === Math.floor(points.length / 2) || idx === points.length - 1) && (
                <text
                  x={p.x}
                  y={height - 10}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {p.date ? p.date.substring(5) : ''}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activePoint && (
          <div style={{
            position: 'absolute',
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
            transform: 'translate(-50%, -125%)',
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            borderRadius: '6px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            color: '#f8fafc',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{activePoint.date}</div>
            <strong style={{ color }}>{activePoint.val} {unit}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Single SVG Bar Chart for Calorie / Activity Minutes distribution.
 */
function SvgBarChart({ data, dataKey, label, unit, color = '#06b6d4' }) {
  const [hoveredBar, setHoveredBar] = useState(null);

  if (!data || data.length === 0) {
    return <div className="chart-empty-state">No distribution data available.</div>;
  }

  const validData = data.filter(d => d[dataKey] !== null && d[dataKey] !== undefined);
  const values = validData.map(d => Number(d[dataKey] || 0));
  const maxVal = Math.max(...values, 1);

  const width = 560;
  const height = 180;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingTop - paddingBottom;

  const barCount = validData.length;
  const availableW = chartW / Math.max(barCount, 1);
  const barWidth = Math.max(Math.min(availableW * 0.6, 24), 6);

  const avgVal = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>{label}</span>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc', marginTop: '0.1rem' }}>
            {avgVal} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>{unit} (Avg)</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Grid Baseline */}
          <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} stroke="rgba(255,255,255,0.1)" />

          {validData.map((d, idx) => {
            const val = Number(d[dataKey] || 0);
            const barH = (val / maxVal) * chartH;
            const x = paddingX + idx * availableW + (availableW - barWidth) / 2;
            const y = height - paddingBottom - barH;

            const isHovered = hoveredBar && hoveredBar.date === d.date;

            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={3}
                  fill={isHovered ? '#ffffff' : color}
                  opacity={isHovered ? 1 : 0.85}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={() => setHoveredBar({ ...d, val, x: x + barWidth / 2, y })}
                  onMouseLeave={() => setHoveredBar(null)}
                />

                {/* X-axis date labels for key steps */}
                {(idx === 0 || idx === Math.floor(validData.length / 2) || idx === validData.length - 1) && (
                  <text
                    x={x + barWidth / 2}
                    y={height - 10}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {d.date ? d.date.substring(5) : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredBar && (
          <div style={{
            position: 'absolute',
            left: `${(hoveredBar.x / width) * 100}%`,
            top: `${(hoveredBar.y / height) * 100}%`,
            transform: 'translate(-50%, -125%)',
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            borderRadius: '6px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            color: '#f8fafc',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{hoveredBar.date}</div>
            <strong style={{ color }}>{hoveredBar.val} {unit}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Composite Trend Charts View Component
 */
export default function TrendCharts({ dailyHistory }) {
  if (!dailyHistory || dailyHistory.length === 0) {
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px border-dashed rgba(255,255,255,0.1)',
        padding: '2rem',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#64748b'
      }}>
        No historical log data available for visual trends yet. Use the Data Logger or Seed utility to populate data.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Activity size={18} style={{ color: '#10b981' }} />
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
          Visual Trend Analytics (Custom SVG)
        </h3>
      </div>

      {/* 2x2 Grid of SVG Trend Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Chart 1: Weight Trend */}
        <SvgLineChart
          data={dailyHistory}
          dataKey="weight"
          label="Weight Profile"
          unit="kg"
          color="#10b981"
        />

        {/* Chart 2: Sleep Hours Trend */}
        <SvgLineChart
          data={dailyHistory}
          dataKey="sleepHours"
          label="Sleep Duration"
          unit="hrs"
          color="#a855f7"
        />

        {/* Chart 3: Calorie Intake Bar Chart */}
        <SvgBarChart
          data={dailyHistory}
          dataKey="calories"
          label="Calorie Intake"
          unit="kcal"
          color="#06b6d4"
        />

        {/* Chart 4: Activity Duration Bar Chart */}
        <SvgBarChart
          data={dailyHistory}
          dataKey="activityMinutes"
          label="Workout Duration"
          unit="mins"
          color="#f59e0b"
        />
      </div>
    </div>
  );
}
