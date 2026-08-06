import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

/**
 * Single SVG Line Chart with gradient fill area and interactive hover tooltips.
 */
function SvgLineChart({ data, dataKey, label, unit, color = '#10b981', strokeWidth = 2.5 }) {
  const [activePoint, setActivePoint] = useState(null);

  if (!data || data.length === 0) return null;

  // Filter valid non-zero data points
  const validPoints = data.filter(d => d[dataKey] !== null && d[dataKey] !== undefined && Number(d[dataKey]) > 0);
  if (validPoints.length === 0) {
    return (
      <div className="auth-card p-6 text-center text-subtle text-muted" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
        No logged entries for {label.toLowerCase()} yet.
      </div>
    );
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

  const points = validPoints.map((d, index) => {
    const x = paddingX + (index / Math.max(validPoints.length - 1, 1)) * chartW;
    const normY = (Number(d[dataKey]) - minVal) / valRange;
    const y = height - paddingBottom - normY * chartH;
    return { x, y, val: Number(d[dataKey]), date: d.date };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
  const gradientId = `grad_${dataKey}_${Math.random().toString(36).substring(2, 7)}`;

  const startVal = points[0].val;
  const endVal = points[points.length - 1].val;
  const delta = (endVal - startVal).toFixed(1);
  const deltaNum = Number(delta);

  return (
    <div className="auth-card p-5 flex-col gap-3" style={{ background: 'rgba(15, 23, 42, 0.6)', position: 'relative' }}>
      {/* Header */}
      <div className="flex-between">
        <div>
          <span className="text-muted text-semibold" style={{ fontSize: '0.85rem' }}>{label} Trend</span>
          <div className="text-white text-bold mt-0" style={{ fontSize: '1.4rem' }}>
            {endVal} <span className="metric-tile-unit">{unit}</span>
          </div>
        </div>
        
        {/* Delta Pill */}
        <div className={`badge ${deltaNum < 0 ? 'badge-primary' : deltaNum > 0 ? 'badge-danger' : 'badge-amber'}`}>
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

          <line x1={paddingX} y1={paddingTop} x2={width - paddingX} y2={paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1={paddingX} y1={paddingTop + chartH / 2} x2={width - paddingX} y2={paddingTop + chartH / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} stroke="rgba(255,255,255,0.1)" />

          <path d={areaD} fill={`url(#${gradientId})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />

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

  if (!data || data.length === 0) return null;

  const validData = data.filter(d => d[dataKey] !== null && d[dataKey] !== undefined && Number(d[dataKey]) > 0);
  if (validData.length === 0) {
    return (
      <div className="auth-card p-6 text-center text-subtle text-muted" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
        No logged entries for {label.toLowerCase()} yet.
      </div>
    );
  }

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
    <div className="auth-card p-5 flex-col gap-3" style={{ background: 'rgba(15, 23, 42, 0.6)', position: 'relative' }}>
      {/* Header */}
      <div className="flex-between">
        <div>
          <span className="text-muted text-semibold" style={{ fontSize: '0.85rem' }}>{label}</span>
          <div className="text-white text-bold mt-0" style={{ fontSize: '1.4rem' }}>
            {avgVal} <span className="metric-tile-unit">{unit} (Avg)</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
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
  // Check if any actual log metrics exist across the dailyHistory array
  const hasRecordedLogs = Array.isArray(dailyHistory) && dailyHistory.length > 0 && dailyHistory.some(d =>
    (d.weight !== null && d.weight !== undefined && d.weight > 0) ||
    (d.sleepHours !== null && d.sleepHours !== undefined && d.sleepHours > 0) ||
    (d.calories !== null && d.calories !== undefined && d.calories > 0) ||
    (d.activityMinutes !== null && d.activityMinutes !== undefined && d.activityMinutes > 0)
  );

  if (!hasRecordedLogs) {
    return (
      <div className="empty-state-callout">
        <div className="empty-state-icon">
          <Activity size={24} />
        </div>
        <h4 className="empty-state-title">
          No Trend Data Recorded Yet
        </h4>
        <p className="empty-state-desc">
          Visual SVG charts for weight, sleep duration, calorie intake, and workout duration will automatically render here as soon as you record daily entries in the Data Logger.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-col gap-6">
      <div className="flex-row gap-2 mb-2">
        <Activity size={18} className="text-emerald" />
        <h3 className="panel-title m-0" style={{ fontSize: '1.15rem' }}>
          Visual Trend Analytics (Custom SVG)
        </h3>
      </div>

      {/* 2x2 Grid of SVG Trend Charts */}
      <div className="grid-2-col">
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
