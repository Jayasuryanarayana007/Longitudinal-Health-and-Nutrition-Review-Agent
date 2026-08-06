import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle } from 'lucide-react';
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
      <div className="auth-card full-width flex-col gap-6 p-8">
        <h4 className="summary-panel-title text-emerald">
          {periodTitle} (Trend Summary)
        </h4>

        {/* 2x3 Grid of core metrics */}
        <div className="grid-metrics">
          <div>
            <div className="metric-tile-label">Avg Calorie Intake</div>
            <div className="metric-tile-value text-white">
              {data.caloriesAvg} <span className="metric-tile-unit">kcal</span>
            </div>
            <div className="metric-tile-label mt-0">
              P: {data.proteinAvg}g | C: {data.carbsAvg}g | F: {data.fatsAvg}g
            </div>
          </div>

          <div>
            <div className="metric-tile-label">Sleep Duration</div>
            <div className="metric-tile-value text-white">
              {data.sleepAvg} <span className="metric-tile-unit">hrs</span>
            </div>
          </div>

          <div>
            <div className="metric-tile-label">Weight Delta</div>
            <div className={`metric-tile-value ${data.weightDelta < 0 ? 'text-emerald-light' : data.weightDelta > 0 ? 'text-rose-light' : 'text-white'}`}>
              {data.weightDelta > 0 ? `+${data.weightDelta}` : data.weightDelta} <span className="metric-tile-unit">kg</span>
            </div>
          </div>

          <div>
            <div className="metric-tile-label">Active Workouts</div>
            <div className="metric-tile-value text-white">
              {data.totalActivityMinutes} <span className="metric-tile-unit">mins</span>
            </div>
          </div>

          <div>
            <div className="metric-tile-label">Avg Mood Rating</div>
            <div className="metric-tile-value text-white">
              {data.moodAvg} <span className="metric-tile-unit">/10</span>
            </div>
          </div>

          <div>
            <div className="metric-tile-label">Avg Energy Level</div>
            <div className="metric-tile-value text-white">
              {data.energyAvg} <span className="metric-tile-unit">/10</span>
            </div>
          </div>
        </div>

        {/* Quantified Workouts Aggregates */}
        <div>
          <h5 className="text-white mb-2 text-semibold">Workouts Summary</h5>
          {data.workoutSummaries && data.workoutSummaries.length > 0 ? (
            <div className="flex-col gap-2">
              {data.workoutSummaries.map((w, idx) => (
                <div key={w.type || idx} className="item-row-card">
                  <span>{w.type} ({w.sessions} sessions)</span>
                  <strong className="text-emerald">{w.totalQty} {w.unit}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-subtle text-muted">No activities logged in this period.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-col gap-8">
      
      {/* Top Header Block */}
      <div className="flex-between flex-wrap gap-4">
        <div>
          <h2 className="panel-title">Dashboard</h2>
          <p className="panel-subtitle">Review calculated aggregates and manage mock database seeding.</p>
        </div>

        {/* Date Context Selection */}
        <div className="flex-row gap-3">
          <label htmlFor="context-date" className="text-muted">Context Date:</label>
          <input
            id="context-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="auth-input input-date-sm"
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
      {error && (
        <div className="alert-banner danger">
          <span>{error}</span>
        </div>
      )}
      {/* Missing Log Detector Top Alert Banner */}
      {summaryData && summaryData.missingDays && summaryData.missingDays.length > 0 && (
        <div className="warning-box">
          <div className="flex-row gap-3">
            <AlertCircle size={20} className="text-amber" />
            <div>
              <strong className="text-white">Missing Log Entries Detected</strong>
              <div className="text-muted mt-0">
                Unlogged days in the past 7 days: <strong>{summaryData.missingDays.join(', ')}</strong>. Continuous tracking improves data integrity.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && !seeding ? (
        <div className="loading-box">
          <div className="spinner spinner-lg"></div>
          <span className="text-muted">Refreshing summaries...</span>
        </div>
      ) : (
        <div className="flex-col gap-8">
          
          {/* TODAY'S ACTIVE APPROVED PLAN CARD */}
          <ActivePlanCard currentUser={currentUser} />

          {/* Averages grid columns */}
          {summaryData && (
            <div className="flex-between flex-wrap gap-6">
              <SummaryPeriodPanel periodTitle="Weekly Trends" data={summaryData.weekly} />
              <SummaryPeriodPanel periodTitle="Monthly Trends" data={summaryData.monthly} />
            </div>
          )}

          {/* SECTION: Custom SVG Trend Charts with Range Selector Switch */}
          {summaryData && summaryData.dailyHistory && (
            <div className="flex-col gap-4">
              {/* Range Toggle Header Bar */}
              <div className="flex-between flex-wrap gap-4">
                <div className="text-muted">
                  Showing <strong className="text-white">{chartRange}-Day</strong> trend analytics
                </div>
                <div className="btn-toggle-group">
                  <button
                    type="button"
                    onClick={() => setChartRange(7)}
                    className={`btn-toggle-item ${chartRange === 7 ? 'active' : ''}`}
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartRange(30)}
                    className={`btn-toggle-item ${chartRange === 30 ? 'active' : ''}`}
                  >
                    30 Days
                  </button>
                </div>
              </div>

              <TrendCharts
                dailyHistory={
                  chartRange === 7 
                    ? (summaryData.dailyHistory || []).slice(-7) 
                    : (summaryData.dailyHistory || [])
                }
              />
            </div>
          )}

          {/* SECTION: Developer Seeding Utility Card */}
          <div className="auth-card full-width p-8">
            <div className="flex-between flex-wrap gap-6">
              <div>
                <h4 className="panel-title text-cyan flex-row gap-2">
                  <Database size={18} /> Admin Test Seeder
                </h4>
                <p className="panel-subtitle">
                  Instantly populates the database with <strong>14 days of realistic daily logs, workout units, and meal calories</strong> to test summaries computations.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSeedData}
                className="auth-submit-btn btn-auto-width"
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
