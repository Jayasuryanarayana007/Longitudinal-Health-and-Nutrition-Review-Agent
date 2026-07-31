import React, { useState, useEffect } from 'react';
import { Database, TrendingDown, Clock, Smile, Flame, ShieldAlert, CheckCircle, Calendar, AlertCircle } from 'lucide-react';
import TrendCharts from './TrendCharts';
import ActivePlanCard from './ActivePlanCard';

export default function Dashboard({ currentUser }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(null);
  const [chartRange, setChartRange] = useState(7); // 7 or 30 days

  // Fetch summaries from the backend
  const fetchSummaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/logs/summaries?username=${encodeURIComponent(currentUser.username)}&date=${encodeURIComponent(date)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch summary data.');
      }
      setSummaryData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, currentUser.username]);

  // Run database seeding
  const handleSeedData = async () => {
    setSeeding(true);
    setSeedSuccess(null);
    setError(null);
    try {
      const response = await fetch('/api/logs/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to seed historical logs.');
      }
      setSeedSuccess('Database seeded successfully! Averages updated.');
      fetchSummaries(); // Refresh averages
    } catch (err) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Helper component to render a summary card
  const SummaryPeriodPanel = ({ periodTitle, data }) => {
    if (!data) return null;
    return (
      <div className="auth-card" style={{ maxWidth: 'none', flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h4 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', color: '#10b981', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
          {periodTitle} (Trend Summary)
        </h4>

        {/* 2x3 Grid of core metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Avg Calorie Intake</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
              {data.caloriesAvg} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#64748b' }}>kcal</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
              P: {data.proteinAvg}g | C: {data.carbsAvg}g | F: {data.fatsAvg}g
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Sleep Duration</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
              {data.sleepAvg} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#64748b' }}>hrs</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Weight Delta</div>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: data.weightDelta < 0 ? '#34d399' : data.weightDelta > 0 ? '#f87171' : '#f8fafc' 
            }}>
              {data.weightDelta > 0 ? `+${data.weightDelta}` : data.weightDelta} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#64748b' }}>kg</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Active Workouts</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
              {data.totalActivityMinutes} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#64748b' }}>mins</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Avg Mood Rating</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
              {data.moodAvg} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#64748b' }}>/10</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Avg Energy Level</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f8fafc' }}>
              {data.energyAvg} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#64748b' }}>/10</span>
            </div>
          </div>
        </div>

        {/* Quantified Workouts Aggregates */}
        <div>
          <h5 style={{ fontSize: '0.9rem', color: '#e2e8f0', margin: '1rem 0 0.5rem 0', fontWeight: '600' }}>Workouts Summary</h5>
          {data.workoutSummaries && data.workoutSummaries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.workoutSummaries.map((w, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.4)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}>
                  <span>{w.type} ({w.sessions} sessions)</span>
                  <strong style={{ color: '#10b981' }}>{w.totalQty} {w.unit}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No activities logged in this period.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Header Block */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#f8fafc' }}>Dashboard</h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>Review calculated aggregates and manage mock database seeding.</p>
        </div>

        {/* Date Context Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Context Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="auth-input"
            style={{ width: '150px', padding: '0.5rem 0.75rem', colorScheme: 'dark' }}
          />
        </div>
      </div>

      {/* Notifications and messages */}
      {seedSuccess && (
        <div className="alert-banner success">
          <CheckCircle size={18} />
          <span>{seedSuccess}</span>
        </div>
      )}
      {/* Missing Log Detector Top Alert Banner */}
      {summaryData && summaryData.missingDays && summaryData.missingDays.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          color: '#fbbf24'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>Missing Log Entries Detected</strong>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                Unlogged days in the past 7 days: <strong>{summaryData.missingDays.join(', ')}</strong>. Continuous tracking improves data integrity.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && !seeding ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto', width: '30px', height: '30px' }}></div>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Refreshing summaries...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* TODAY'S ACTIVE APPROVED PLAN CARD */}
          <ActivePlanCard currentUser={currentUser} />

          {/* Averages grid columns */}
          {summaryData && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              <SummaryPeriodPanel periodTitle="Weekly Trends" data={summaryData.weekly} />
              <SummaryPeriodPanel periodTitle="Monthly Trends" data={summaryData.monthly} />
            </div>
          )}

          {/* SECTION: Custom SVG Trend Charts with Range Selector Switch */}
          {summaryData && summaryData.dailyHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Range Toggle Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Showing <strong style={{ color: '#f8fafc' }}>{chartRange}-Day</strong> trend analytics
                </div>
                <div style={{
                  display: 'flex',
                  background: '#151d30',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <button
                    type="button"
                    onClick={() => setChartRange(7)}
                    style={{
                      background: chartRange === 7 ? '#10b981' : 'transparent',
                      color: chartRange === 7 ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartRange(30)}
                    style={{
                      background: chartRange === 30 ? '#10b981' : 'transparent',
                      color: chartRange === 30 ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    30 Days
                  </button>
                </div>
              </div>

              <TrendCharts
                dailyHistory={
                  chartRange === 7 
                    ? summaryData.dailyHistory.slice(-7) 
                    : summaryData.dailyHistory
                }
              />
            </div>
          )}

          {/* SECTION: Developer Seeding Utility Card */}
          <div className="auth-card" style={{ maxWidth: 'none', padding: '2rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={18} style={{ color: '#06b6d4' }} /> Admin Test Seeder
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                  Instantly populates the database with <strong>14 days of realistic daily logs, workout units, and meal calories</strong> to test summaries computations.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSeedData}
                className="auth-submit-btn"
                style={{ width: 'auto', padding: '0.75rem 1.5rem', marginTop: 0 }}
                disabled={seeding}
              >
                {seeding ? (
                  <div className="spinner"></div>
                ) : (
                  'Seed 14 Days of Mock Logs'
                )}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
