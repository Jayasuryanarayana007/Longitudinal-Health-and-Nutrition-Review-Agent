import React, { useState, useEffect } from 'react';
import { Target, Edit3, CheckCircle, ShieldAlert, Sparkles, Scale, Moon, Flame, Activity } from 'lucide-react';

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
    targetSleepHours: '',
    targetActivityMinutes: ''
  });

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
          targetSleepHours: String(data.goal.targetSleepHours || 8.0),
          targetActivityMinutes: String(data.goal.targetActivityMinutes || 30)
        });
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
          targetWeight: parseFloat(formData.targetWeight),
          targetDailyCalories: parseFloat(formData.targetDailyCalories),
          targetSleepHours: parseFloat(formData.targetSleepHours),
          targetActivityMinutes: parseInt(formData.targetActivityMinutes)
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
          onClick={() => setIsEditing(!isEditing)}
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

      {/* Success/Error Notifications */}
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

      {/* VIEW MODE: 4 Core Target Cards */}
      {!isEditing ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <Scale size={14} style={{ color: '#10b981' }} /> Target Weight
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
              {goal ? goal.targetWeight : 75.0} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>kg</span>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <Flame size={14} style={{ color: '#06b6d4' }} /> Target Daily Calories
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
              {goal ? goal.targetDailyCalories : 2000} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>kcal</span>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <Moon size={14} style={{ color: '#a855f7' }} /> Target Sleep Duration
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
              {goal ? goal.targetSleepHours : 8.0} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>hrs</span>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <Activity size={14} style={{ color: '#f59e0b' }} /> Target Activity
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
              {goal ? goal.targetActivityMinutes : 30} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>mins / day</span>
            </div>
          </div>
        </div>
      ) : (
        /* EDIT MODE: Interactive Form */
        <form onSubmit={handleSaveGoals} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
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

          <div className="auth-input-group" style={{ marginBottom: 0 }}>
            <label className="auth-label">Target Workouts (mins/day)</label>
            <input
              type="number"
              min="1"
              max="300"
              value={formData.targetActivityMinutes}
              onChange={(e) => setFormData({ ...formData, targetActivityMinutes: e.target.value })}
              className="auth-input"
              style={{ paddingLeft: '0.75rem' }}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            style={{ marginTop: 0, padding: '0.65rem 1rem', fontSize: '0.85rem' }}
            disabled={saving}
          >
            {saving ? <div className="spinner"></div> : 'Save New Goals Profile (vNext)'}
          </button>
        </form>
      )}
    </div>
  );
}
