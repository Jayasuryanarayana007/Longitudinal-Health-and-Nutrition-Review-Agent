import React, { useState, useEffect } from 'react';
import { Target, Edit3, CheckCircle, ShieldAlert, Scale, Moon, Flame, Activity, Plus, Trash } from 'lucide-react';

export default function GoalProfileCard({ currentUser, onGoalsUpdated }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    targetWeight: '',
    targetDailyCalories: '',
    targetSleepHours: ''
  });

  // Multiple Target Activities State
  const [targetActivities, setTargetActivities] = useState([
    { type: 'Walking', durationMinutes: '30', quantity: '5000', unit: 'steps' }
  ]);

  const fetchActiveGoal = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/plans/goals?username=${encodeURIComponent(currentUser.username)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch goal profile.');
      
      setGoal(data.goal);
      if (data.goal) {
        setFormData({
          targetWeight: String(data.goal.targetWeight || 75.0),
          targetDailyCalories: String(data.goal.targetDailyCalories || 2000),
          targetSleepHours: String(data.goal.targetSleepHours || 8.0)
        });

        if (Array.isArray(data.goal.targetActivities) && data.goal.targetActivities.length > 0) {
          setTargetActivities(data.goal.targetActivities.map(a => ({
            type: a.type || 'Workout',
            durationMinutes: String(a.durationMinutes || 15),
            quantity: a.quantity !== null && a.quantity !== undefined ? String(a.quantity) : '',
            unit: a.unit || 'mins'
          })));
        } else {
          setTargetActivities([
            { type: 'Workout', durationMinutes: String(data.goal.targetActivityMinutes || 30), quantity: '', unit: 'mins' }
          ]);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveGoal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username]);

  const handleActivityChange = (index, field, val) => {
    const updated = [...targetActivities];
    updated[index][field] = val;
    setTargetActivities(updated);
  };

  const addTargetActivityRow = () => {
    setTargetActivities([
      ...targetActivities,
      { type: 'Running', durationMinutes: '20', quantity: '3', unit: 'km' }
    ]);
  };

  const removeTargetActivityRow = (index) => {
    if (targetActivities.length <= 1) return;
    const updated = [...targetActivities];
    updated.splice(index, 1);
    setTargetActivities(updated);
  };

  const handleSaveGoals = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/plans/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          targetWeight: parseFloat(formData.targetWeight) || 75.0,
          targetDailyCalories: parseFloat(formData.targetDailyCalories) || 2000.0,
          targetSleepHours: parseFloat(formData.targetSleepHours) || 8.0,
          targetActivities: targetActivities.map(a => ({
            type: a.type || 'Workout',
            durationMinutes: parseInt(a.durationMinutes) || 15,
            quantity: a.quantity !== '' ? parseFloat(a.quantity) : null,
            unit: a.unit || 'mins'
          }))
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save goals profile.');

      setSuccess(`Active Goals Profile updated to version v${data.version}!`);
      setGoal(data.goal);
      setIsEditing(false);

      if (onGoalsUpdated) onGoalsUpdated();

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-card full-width loading-box">
        <div className="spinner spinner-lg"></div>
        <span className="text-muted">Loading active target goals...</span>
      </div>
    );
  }

  const activeTargetActivitiesList = goal && Array.isArray(goal.targetActivities) ? goal.targetActivities : [];
  const totalWeeklyTargetMins = activeTargetActivitiesList.reduce((acc, curr) => acc + ((curr.durationMinutes || 0) * 7), 0);

  return (
    <div className="auth-card full-width p-8 flex-col gap-5">
      {/* Header bar */}
      <div className="card-header-flex">
        <div className="flex-row gap-3">
          <div className="app-brand-icon">
            <Target size={20} />
          </div>
          <div>
            <h3 className="panel-title text-white m-0" style={{ fontSize: '1.1rem' }}>
              Active Wellness Goals Profile
            </h3>
            {goal ? (
              <span className="flex-row gap-2 text-muted" style={{ fontSize: '0.85rem' }}>
                Version <strong className="badge-version">v{goal.version}</strong> (Active) • Updated {new Date(goal.createdAt).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>No goals configured yet</span>
            )}
          </div>
        </div>

        {!isEditing && goal && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="btn-secondary"
          >
            <Edit3 size={14} /> Update Goals
          </button>
        )}
      </div>

      {success && (
        <div className="alert-banner success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="alert-banner danger">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW MODE */}
      {!isEditing ? (
        !goal ? (
          /* EMPTY GOALS CALLOUT STATE FOR NEW USERS */
          <div className="empty-state-callout">
            <div className="empty-state-icon">
              <Target size={28} />
            </div>
            <div>
              <h4 className="empty-state-title">
                No Active Wellness Goals Configured Yet
              </h4>
              <p className="empty-state-desc">
                Welcome! Set your custom daily targets for weight, calories, sleep, and target physical activities to personalize your AI wellness reviews and progress tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormData({ targetWeight: '70', targetDailyCalories: '2000', targetSleepHours: '8' });
                setTargetActivities([{ type: 'Walking', durationMinutes: '30', quantity: '5000', unit: 'steps' }]);
                setIsEditing(true);
              }}
              className="auth-submit-btn btn-auto-width"
            >
              <Plus size={16} /> Set Your Initial Wellness Goals
            </button>
          </div>
        ) : (
          <div className="flex-col gap-5">
            
            {/* Top 3 Metric Cards: Weight, Calories, Sleep */}
            <div className="grid-metrics">
              <div className="metric-tile">
                <div className="metric-tile-label flex-row gap-1">
                  <Scale size={14} className="text-emerald" /> Target Weight
                </div>
                <div className="metric-tile-value text-white">
                  {goal.targetWeight} <span className="metric-tile-unit">kg</span>
                </div>
              </div>

              <div className="metric-tile">
                <div className="metric-tile-label flex-row gap-1">
                  <Flame size={14} className="text-cyan" /> Target Daily Calories
                </div>
                <div className="metric-tile-value text-white">
                  {goal.targetDailyCalories} <span className="metric-tile-unit">kcal</span>
                </div>
              </div>

              <div className="metric-tile">
                <div className="metric-tile-label flex-row gap-1">
                  <Moon size={14} className="text-purple" /> Target Sleep Duration
                </div>
                <div className="metric-tile-value text-white">
                  {goal.targetSleepHours} <span className="metric-tile-unit">hrs</span>
                </div>
              </div>
            </div>

            {/* MULTIPLE TARGET ACTIVITIES DISPLAY PANEL */}
            <div className="followup-container">
              <div className="flex-between">
                <div className="text-amber text-semibold flex-row gap-2" style={{ fontSize: '0.85rem' }}>
                  <Activity size={16} /> Target Physical Activities (Multiple Targets Supported)
                </div>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Total Target: <strong className="text-white">{totalWeeklyTargetMins} mins / week</strong>
                </span>
              </div>

              <div className="flex-row flex-wrap gap-3">
                {activeTargetActivitiesList.map((act, idx) => (
                  <div key={act.type || idx} className="badge badge-amber flex-row gap-2">
                    <span className="text-bold text-amber">{act.type}</span>
                    <span className="text-main" style={{ fontSize: '0.8rem' }}>
                      {act.durationMinutes} mins {act.quantity ? `(${act.quantity} ${act.unit})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )
      ) : (
        /* EDIT MODE FORM */
        <form onSubmit={handleSaveGoals} className="flex-col gap-5">
          
          <div className="grid-metrics">
            <div className="auth-input-group m-0">
              <label htmlFor="targetWeight" className="auth-label">Target Weight (kg)</label>
              <input
                id="targetWeight"
                type="number"
                step="any"
                min="30"
                max="300"
                value={formData.targetWeight}
                onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                className="auth-input"
                required
              />
            </div>

            <div className="auth-input-group m-0">
              <label htmlFor="targetDailyCalories" className="auth-label">Target Daily Cals (kcal)</label>
              <input
                id="targetDailyCalories"
                type="number"
                step="any"
                min="500"
                max="10000"
                value={formData.targetDailyCalories}
                onChange={(e) => setFormData({ ...formData, targetDailyCalories: e.target.value })}
                className="auth-input"
                required
              />
            </div>

            <div className="auth-input-group m-0">
              <label htmlFor="targetSleepHours" className="auth-label">Target Sleep (hrs)</label>
              <input
                id="targetSleepHours"
                type="number"
                step="any"
                min="1"
                max="24"
                value={formData.targetSleepHours}
                onChange={(e) => setFormData({ ...formData, targetSleepHours: e.target.value })}
                className="auth-input"
                required
              />
            </div>
          </div>

          {/* DYNAMIC MULTIPLE TARGET ACTIVITIES EDITOR */}
          <div className="followup-container">
            <div className="flex-between">
              <label className="auth-label text-amber m-0">
                Configure Multiple Target Activities
              </label>
              <button
                type="button"
                onClick={addTargetActivityRow}
                className="badge badge-amber"
              >
                <Plus size={14} /> Add Target Activity
              </button>
            </div>

            <div className="flex-col gap-2">
              {targetActivities.map((act, index) => (
                <div key={index} className="flex-row gap-2 items-center">
                  <input
                    type="text"
                    value={act.type}
                    onChange={(e) => handleActivityChange(index, 'type', e.target.value)}
                    placeholder="Activity (e.g. Running)"
                    className="auth-input"
                    required
                  />
                  <input
                    type="number"
                    value={act.durationMinutes}
                    onChange={(e) => handleActivityChange(index, 'durationMinutes', e.target.value)}
                    placeholder="Mins/day"
                    className="auth-input"
                    required
                  />
                  <input
                    type="number"
                    value={act.quantity}
                    onChange={(e) => handleActivityChange(index, 'quantity', e.target.value)}
                    placeholder="Target Qty (opt)"
                    className="auth-input"
                  />
                  <select
                    value={act.unit}
                    onChange={(e) => handleActivityChange(index, 'unit', e.target.value)}
                    className="auth-select"
                  >
                    <option value="steps">steps</option>
                    <option value="km">km</option>
                    <option value="miles">miles</option>
                    <option value="reps">reps</option>
                    <option value="mins">mins</option>
                  </select>

                  {targetActivities.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTargetActivityRow(index)}
                      className="btn-danger p-2"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn btn-auto-width"
            disabled={saving}
          >
            {saving ? <div className="spinner"></div> : 'Save New Goals Profile (vNext)'}
          </button>
        </form>
      )}
    </div>
  );
}
