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
            quantity: a.quantity ? parseFloat(a.quantity) : null,
            unit: a.unit || 'mins'
          }))
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update goal profile.');

      setGoal(data.goal);
      setIsEditing(false);
      setSuccess(`Active Goal Profile updated to Version v${data.goal.version}!`);
      if (onGoalsUpdated) onGoalsUpdated(data.goal);

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
        <div className="spinner" style={{ margin: '0 auto 0.5rem auto' }}></div>
        Loading Active Goals Profile...
      </div>
    );
  }

  const activeTargetActivitiesList = (goal && Array.isArray(goal.targetActivities))
    ? goal.targetActivities
    : [];

  const totalWeeklyTargetMins = activeTargetActivitiesList.reduce((s, a) => s + (parseInt(a.durationMinutes) || 0), 0) * 7;

  return (
    <div className="auth-card" style={{ maxWidth: 'none', padding: '1.75rem', background: 'rgba(15, 23, 42, 0.6)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#10b981', display: 'flex' }}>
            <Target size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.1rem', margin: 0, color: '#f8fafc', fontWeight: '700' }}>
              Active Wellness Goals Profile
            </h4>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Version <strong style={{ color: '#10b981' }}>v{goal ? goal.version : 1}</strong> ({goal ? goal.status : 'Active'})
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!isEditing && (!formData.targetWeight || !formData.targetDailyCalories || !formData.targetSleepHours)) {
              setFormData({
                targetWeight: goal?.targetWeight ? String(goal.targetWeight) : '75',
                targetDailyCalories: goal?.targetDailyCalories ? String(goal.targetDailyCalories) : '2000',
                targetSleepHours: goal?.targetSleepHours ? String(goal.targetSleepHours) : '8'
              });
            }
            setIsEditing(!isEditing);
          }}
          style={{
            background: isEditing ? 'rgba(255,255,255,0.08)' : 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            padding: '0.45rem 0.9rem',
            color: '#34d399',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Edit3 size={14} /> {isEditing ? 'Cancel Edit' : 'Edit Goals Profile'}
        </button>
      </div>

      {/* Notifications */}
      {success && (
        <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW MODE */}
      {!isEditing ? (
        !goal ? (
          /* EMPTY GOALS CALLOUT STATE FOR NEW USERS */
          <div style={{
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px dashed rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.75rem', borderRadius: '50%', color: '#10b981' }}>
              <Target size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.4rem 0', fontWeight: '700' }}>
                No Active Wellness Goals Configured Yet
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, maxWidth: '480px', lineHeight: '1.5' }}>
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
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.5rem',
                color: '#ffffff',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              <Plus size={16} /> Set Your Initial Wellness Goals
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Top 3 Metric Cards: Weight, Calories, Sleep */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <Scale size={14} style={{ color: '#10b981' }} /> Target Weight
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
                  {goal.targetWeight} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>kg</span>
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <Flame size={14} style={{ color: '#06b6d4' }} /> Target Daily Calories
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
                  {goal.targetDailyCalories} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>kcal</span>
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <Moon size={14} style={{ color: '#a855f7' }} /> Target Sleep Duration
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
                  {goal.targetSleepHours} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>hrs</span>
                </div>
              </div>
            </div>

            {/* MULTIPLE TARGET ACTIVITIES DISPLAY PANEL */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.4)',
              padding: '1.25rem',
              borderRadius: '10px',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Activity size={16} /> Target Physical Activities (Multiple Targets Supported)
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Total Target: <strong style={{ color: '#f8fafc' }}>{totalWeeklyTargetMins} mins / week</strong>
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {activeTargetActivitiesList.map((act, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    color: '#f8fafc'
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fbbf24' }}>{act.type}</span>
                    <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
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
        <form onSubmit={handleSaveGoals} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div className="auth-input-group" style={{ marginBottom: 0 }}>
              <label className="auth-label">Target Weight (kg)</label>
              <input
                type="number"
                step="any"
                min="30"
                max="300"
                value={formData.targetWeight}
                onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                className="auth-input"
                style={{ paddingLeft: '0.75rem' }}
                required
              />
            </div>

            <div className="auth-input-group" style={{ marginBottom: 0 }}>
              <label className="auth-label">Target Daily Cals (kcal)</label>
              <input
                type="number"
                step="any"
                min="500"
                max="10000"
                value={formData.targetDailyCalories}
                onChange={(e) => setFormData({ ...formData, targetDailyCalories: e.target.value })}
                className="auth-input"
                style={{ paddingLeft: '0.75rem' }}
                required
              />
            </div>

            <div className="auth-input-group" style={{ marginBottom: 0 }}>
              <label className="auth-label">Target Sleep (hrs)</label>
              <input
                type="number"
                step="any"
                min="1"
                max="24"
                value={formData.targetSleepHours}
                onChange={(e) => setFormData({ ...formData, targetSleepHours: e.target.value })}
                className="auth-input"
                style={{ paddingLeft: '0.75rem' }}
                required
              />
            </div>
          </div>

          {/* DYNAMIC MULTIPLE TARGET ACTIVITIES EDITOR */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.3)',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-label" style={{ color: '#fbbf24', margin: 0 }}>
                Configure Multiple Target Activities
              </label>
              <button
                type="button"
                onClick={addTargetActivityRow}
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: 'none',
                  color: '#fbbf24',
                  borderRadius: '4px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Plus size={14} /> Add Target Activity
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {targetActivities.map((act, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={act.type}
                    onChange={(e) => handleActivityChange(index, 'type', e.target.value)}
                    placeholder="Activity (e.g. Running)"
                    className="auth-input"
                    style={{ paddingLeft: '0.75rem' }}
                    required
                  />
                  <input
                    type="number"
                    value={act.durationMinutes}
                    onChange={(e) => handleActivityChange(index, 'durationMinutes', e.target.value)}
                    placeholder="Mins/day"
                    className="auth-input"
                    style={{ paddingLeft: '0.75rem' }}
                    required
                  />
                  <input
                    type="number"
                    value={act.quantity}
                    onChange={(e) => handleActivityChange(index, 'quantity', e.target.value)}
                    placeholder="Target Qty (opt)"
                    className="auth-input"
                    style={{ paddingLeft: '0.75rem' }}
                  />
                  <select
                    value={act.unit}
                    onChange={(e) => handleActivityChange(index, 'unit', e.target.value)}
                    className="auth-select"
                    style={{ paddingLeft: '0.75rem' }}
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
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
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
            className="auth-submit-btn"
            style={{ marginTop: 0, padding: '0.75rem 1.5rem', fontSize: '0.85rem', width: 'fit-content' }}
            disabled={saving}
          >
            {saving ? <div className="spinner"></div> : 'Save New Goals Profile (vNext)'}
          </button>
        </form>
      )}
    </div>
  );
}
