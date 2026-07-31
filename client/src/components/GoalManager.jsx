import React, { useState, useEffect } from 'react';
import { Target, Clock, RefreshCw, CheckCircle2, History } from 'lucide-react';

export default function GoalManager({ username, activeGoal, onGoalsUpdated }) {
  const [formData, setFormData] = useState({
    targetSleepHours: activeGoal.targetSleepHours || 8.0,
    targetDailyCalories: activeGoal.targetDailyCalories || 2000.0,
    targetActivityMinutes: activeGoal.targetActivityMinutes || 30
  });

  const [goalHistory, setGoalHistory] = useState([]);
  const [planHistory, setPlanHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Load history on mount
  const loadHistory = async () => {
    setLoading(true);
    try {
      const userLower = username.toLowerCase();
      
      // Fetch plan history
      const plansResponse = await fetch(`/api/plans/history?username=${userLower}`);
      const plansData = await plansResponse.json();
      if (plansResponse.ok) {
        setPlanHistory(plansData.plans || []);
      }

      // Fetch goals version history
      // Express doesn't have a dedicated route, we query a select in our custom endpoint or add it.
      // We can fetch it by adding a simple endpoint or fetch active details. Let's make an API call.
      const goalsResponse = await fetch(`/api/plans/active?username=${userLower}`); // Simple check
      // For goals history, we can hit GET /api/plans/history which returns plans, and we can query goals from db.
      // Wait, let's look at how we fetch goals history. Let's fetch goals history from backend!
      // In plans router, we didn't add a GET /goals/history, but we can query it easily if we fetch the active goals,
      // or we can fetch goals history by calling a simple endpoint. Let's create an endpoint in plans.js or query it.
      // Actually, we can retrieve goals history by writing a quick route inside plans.js. Wait, did we do that?
      // In plans.js we have POST /goals. Let's check if we can fetch goals history. Let's add GET /goals/history to plans.js!
      // First, let's write the frontend fetching assuming we'll add GET /goals/history to plans.js.
      const goalsHistResponse = await fetch(`/api/plans/goals/history?username=${userLower}`);
      const goalsHistData = await goalsHistResponse.json();
      if (goalsHistResponse.ok) {
        setGoalHistory(goalsHistData.goals || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // Update local state when parent goal updates
    setFormData({
      targetSleepHours: activeGoal.targetSleepHours || 8.0,
      targetDailyCalories: activeGoal.targetDailyCalories || 2000.0,
      targetActivityMinutes: activeGoal.targetActivityMinutes || 30
    });
  }, [activeGoal]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: Number(e.target.value) || 0
    });
  };

  const handleUpdateGoals = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/plans/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          targetSleepHours: formData.targetSleepHours,
          targetDailyCalories: formData.targetDailyCalories,
          targetActivityMinutes: formData.targetActivityMinutes
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update goals');
      }

      setSuccessMsg('Goals updated and versioned successfully!');
      onGoalsUpdated(data.activeGoal); // Callback to update session state in parent App.jsx
      loadHistory(); // Refresh history tables

    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Goals & Plan Manager</h1>
        <p>Edit daily profile targets and inspect plan version histories.</p>
      </div>

      {successMsg && (
        <div className="alert-banner success">
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-banner danger">
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid-cols-3" style={{ gap: '2rem' }}>
        
        {/* LEFT COLUMN: Update Profile Goals (1/3 width) */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Target size={18} style={{ color: 'var(--color-primary)' }} />
            Profile Targets (v{activeGoal.version || 1})
          </h3>

          <form onSubmit={handleUpdateGoals} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="targetSleepHours">Target Sleep Duration (hours)</label>
              <input
                type="number"
                step="0.1"
                id="targetSleepHours"
                name="targetSleepHours"
                value={formData.targetSleepHours}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="targetDailyCalories">Target Daily Calories (kcal)</label>
              <input
                type="number"
                id="targetDailyCalories"
                name="targetDailyCalories"
                value={formData.targetDailyCalories}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="targetActivityMinutes">Target Daily Activity (minutes)</label>
              <input
                type="number"
                id="targetActivityMinutes"
                name="targetActivityMinutes"
                value={formData.targetActivityMinutes}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Update Targets
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Goals & Plans Timeline History (2/3 width) */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Goal Versions Log Table */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <History size={18} style={{ color: 'var(--color-secondary)' }} />
              Goals Version History
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.5rem' }}>Version</th>
                    <th style={{ padding: '0.5rem' }}>Sleep Target</th>
                    <th style={{ padding: '0.5rem' }}>Calorie Target</th>
                    <th style={{ padding: '0.5rem' }}>Activity Target</th>
                    <th style={{ padding: '0.5rem' }}>Created At</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {goalHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No goal versions found.
                      </td>
                    </tr>
                  ) : (
                    goalHistory.map(g => (
                      <tr key={g.goalId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>v{g.version}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{g.targetSleepHours} hrs</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{g.targetDailyCalories} kcal</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{g.targetActivityMinutes} mins</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{new Date(g.createdAt).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className={`badge ${g.status === 'Active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                            {g.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Plans Versions History Table */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Clock size={18} style={{ color: 'var(--color-accent)' }} />
              Active & Archived AI Plans
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.5rem' }}>Version</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Proposed Date</th>
                    <th style={{ padding: '0.5rem' }}>Approved/Rejection Date</th>
                    <th style={{ padding: '0.5rem' }}>Rejection Reason / Recommendations</th>
                  </tr>
                </thead>
                <tbody>
                  {planHistory.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No plan logs found. Initiate a Weekly Review to generate plans.
                      </td>
                    </tr>
                  ) : (
                    planHistory.map(p => (
                      <tr key={p.planId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', verticalAlign: 'top' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>V{p.version}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className={`badge ${
                            p.status === 'Active' ? 'badge-success' : 
                            p.status === 'Rejected' ? 'badge-danger' : 
                            p.status === 'Pending' ? 'badge-warning' : 'badge-default'
                          }`} style={{ fontSize: '0.7rem' }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                          {p.responseAt ? new Date(p.responseAt).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', maxWidth: '300px', fontSize: '0.8rem', lineHeight: '1.4' }}>
                          {p.status === 'Rejected' ? (
                            <span style={{ color: 'var(--color-alert)' }}><strong>Reason:</strong> {p.userRejectionReason}</span>
                          ) : (
                            <ul style={{ paddingLeft: '1rem', listStyleType: 'square' }}>
                              {p.suggestions.map((s, idx) => (
                                <li key={idx} style={{ marginBottom: '0.25rem' }}>{s.proposal}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
