import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Calendar, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function DataLogger({ username, onLogSubmitted }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    sleepHours: '',
    moodScore: 5,
    energyScore: 5
  });

  const [mealText, setMealText] = useState('');
  const [extractedMeals, setExtractedMeals] = useState([]);
  const [isAiUncertain, setIsAiUncertain] = useState(false);
  const [isUserCorrected, setIsUserCorrected] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);

  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState({
    type: '',
    durationMinutes: '',
    intensity: 'Medium'
  });

  const [blockingError, setBlockingError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleMetricChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // AI Meal Calorie Extractor
  const handleExtractMeals = async () => {
    if (!mealText.trim()) return;
    setExtractLoading(true);
    setBlockingError(null);
    try {
      const response = await fetch('/api/reviews/meals/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textInput: mealText })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to extract meals');
      }
      
      setExtractedMeals(data.extractedItems || []);
      setIsAiUncertain(data.isAiUncertain || false);
      setIsUserCorrected(false); // Reset correction state on new extraction
    } catch (err) {
      setBlockingError(err.message);
    } finally {
      setExtractLoading(false);
    }
  };

  // CRUD for meal items list
  const handleMealItemEdit = (index, field, value) => {
    const updated = [...extractedMeals];
    updated[index] = {
      ...updated[index],
      [field]: field === 'foodItem' ? value : Number(value) || 0
    };
    setExtractedMeals(updated);
    setIsUserCorrected(true);
  };

  const handleAddMealItem = () => {
    setExtractedMeals([
      ...extractedMeals,
      { foodItem: 'New Item', calories: 200, protein: 10, carbs: 20, fats: 5, isAiUncertain: false }
    ]);
    setIsUserCorrected(true);
  };

  const handleDeleteMealItem = (index) => {
    const updated = extractedMeals.filter((_, i) => i !== index);
    setExtractedMeals(updated);
    setIsUserCorrected(true);
  };

  // CRUD for activities
  const handleAddActivity = () => {
    if (!newActivity.type || !newActivity.durationMinutes) return;
    setActivities([
      ...activities,
      {
        activityId: 'act_' + Math.random().toString(36).substr(2, 9),
        type: newActivity.type,
        durationMinutes: Number(newActivity.durationMinutes),
        intensity: newActivity.intensity
      }
    ]);
    setNewActivity({ type: '', durationMinutes: '', intensity: 'Medium' });
  };

  const handleDeleteActivity = (id) => {
    setActivities(activities.filter(a => a.activityId !== id));
  };

  // Save the full daily log payload (with blocking check handlers)
  const handleSubmitLog = async (e) => {
    e.preventDefault();
    setBlockingError(null);
    setSuccessMsg(null);
    setSubmitLoading(true);

    const payload = {
      username,
      date: formData.date,
      weight: Number(formData.weight),
      sleepHours: Number(formData.sleepHours),
      moodScore: Number(formData.moodScore),
      energyScore: Number(formData.energyScore),
      meals: extractedMeals.length > 0 ? [{
        textInput: mealText,
        aiEstimates: extractedMeals, // Standard saving parameters
        correctedEstimates: extractedMeals,
        isUserCorrected,
        isAiUncertain
      }] : [],
      activities
    };

    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        // Expose blocking data-quality warning in modal
        if (data.isBlocking) {
          setBlockingError(data.message);
          setSubmitLoading(false);
          return;
        }
        throw new Error(data.message || 'Failed to submit logs');
      }

      // If user corrected the AI estimations, log this event explicitly to audits
      if (isUserCorrected && extractedMeals.length > 0) {
        await fetch('/api/audits/log-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            eventType: 'UserCorrection',
            description: `User corrected calorie estimates for date ${formData.date}`,
            details: {
              date: formData.date,
              mealText,
              items: extractedMeals
            }
          })
        });
      }

      setSuccessMsg('Daily metrics saved and logged successfully!');
      
      // Reset forms
      setMealText('');
      setExtractedMeals([]);
      setActivities([]);
      setIsUserCorrected(false);
      setIsAiUncertain(false);
      
      // Callback to trigger dashboard parent update
      onLogSubmitted();

    } catch (err) {
      setBlockingError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Daily Metrics Logger</h1>
        <p>Record daily sleep, weight, mood, physical activity, and meals.</p>
      </div>

      {successMsg && (
        <div className="alert-banner success">
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Blocking Error Modal Notification */}
      {blockingError && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', color: 'var(--color-alert)' }}>
              <ShieldAlert size={28} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Data Quality Check Failed</h3>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {blockingError}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setBlockingError(null)} className="btn btn-danger">
                Acknowledge & Edit
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmitLog} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="grid-cols-3">
          {/* Calendar Picker Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
              Log Date
            </h3>
            <div>
              <label htmlFor="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleMetricChange}
                required
              />
            </div>
          </div>

          {/* Core Metrics Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem' }}>Body & Sleep Metrics</h3>
            <div className="grid-cols-2" style={{ gap: '0.75rem' }}>
              <div>
                <label htmlFor="weight">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  id="weight"
                  name="weight"
                  value={formData.weight}
                  onChange={handleMetricChange}
                  placeholder="e.g. 72.5"
                  required
                />
              </div>
              <div>
                <label htmlFor="sleepHours">Sleep (hrs)</label>
                <input
                  type="number"
                  step="0.1"
                  id="sleepHours"
                  name="sleepHours"
                  value={formData.sleepHours}
                  onChange={handleMetricChange}
                  placeholder="e.g. 7.5"
                  required
                />
              </div>
            </div>
          </div>

          {/* Mood & Energy Ratings Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem' }}>Daily Score Ratings</h3>
            <div className="grid-cols-2" style={{ gap: '0.75rem' }}>
              <div>
                <label htmlFor="moodScore">Mood ({formData.moodScore}/10)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  id="moodScore"
                  name="moodScore"
                  value={formData.moodScore}
                  onChange={handleMetricChange}
                  style={{ padding: 0, height: '1.5rem', cursor: 'pointer' }}
                />
              </div>
              <div>
                <label htmlFor="energyScore">Energy ({formData.energyScore}/10)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  id="energyScore"
                  name="energyScore"
                  value={formData.energyScore}
                  onChange={handleMetricChange}
                  style={{ padding: 0, height: '1.5rem', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Text-Based Meal Extraction Layout */}
        <div className="grid-cols-2">
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Meals & Calories (Text AI Extraction)</h3>
            <div>
              <label htmlFor="mealText">Describe what you ate today</label>
              <textarea
                id="mealText"
                rows="4"
                value={mealText}
                onChange={(e) => setMealText(e.target.value)}
                placeholder="Example: I had two rotis and dal makhani for lunch, then oatmeal with banana for dinner."
                style={{ resize: 'vertical' }}
              />
            </div>
            <button
              type="button"
              onClick={handleExtractMeals}
              className="btn btn-secondary"
              style={{ gap: '0.5rem', alignSelf: 'flex-start' }}
              disabled={extractLoading || !mealText.trim()}
            >
              {extractLoading ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />}
              Extract Calories
            </button>
          </div>

          {/* AI Calorie Estimator CRUD Grid */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Extracted Food Items</h3>
              {extractedMeals.length > 0 && (
                <button type="button" onClick={handleAddMealItem} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.25rem' }}>
                  <Plus size={14} /> Add Item
                </button>
              )}
            </div>

            {extractedMeals.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '2rem' }}>
                Describe a meal on the left and click Extract to see estimates.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
                {isAiUncertain && (
                  <span className="badge badge-warning" style={{ alignSelf: 'flex-start', marginBottom: '0.25rem' }}>
                    ⚠️ AI Uncertainty detected in parsing. Please review numbers.
                  </span>
                )}
                {extractedMeals.map((meal, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', background: meal.isAiUncertain ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <input
                      type="text"
                      value={meal.foodItem}
                      onChange={(e) => handleMealItemEdit(index, 'foodItem', e.target.value)}
                      style={{ flex: 2, padding: '0.4rem' }}
                      placeholder="Food Item"
                    />
                    <input
                      type="number"
                      value={meal.calories}
                      onChange={(e) => handleMealItemEdit(index, 'calories', e.target.value)}
                      style={{ flex: 1, padding: '0.4rem' }}
                      placeholder="kcal"
                    />
                    <button type="button" onClick={() => handleDeleteMealItem(index)} style={{ background: 'none', border: 'none', color: 'var(--color-alert)', cursor: 'pointer', padding: '0.25rem' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Physical Exercise Activities CRUD */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Physical Exercises & Workouts</h3>
          
          <div className="grid-cols-4" style={{ alignItems: 'flex-end', gap: '1rem' }}>
            <div>
              <label>Exercise Type</label>
              <input
                type="text"
                value={newActivity.type}
                onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                placeholder="e.g. Walking, Running, Yoga"
              />
            </div>
            <div>
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={newActivity.durationMinutes}
                onChange={(e) => setNewActivity({ ...newActivity, durationMinutes: e.target.value })}
                placeholder="e.g. 45"
              />
            </div>
            <div>
              <label>Intensity</label>
              <select
                value={newActivity.intensity}
                onChange={(e) => setNewActivity({ ...newActivity, intensity: e.target.value })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <button type="button" onClick={handleAddActivity} className="btn btn-secondary" style={{ gap: '0.25rem' }}>
              <Plus size={16} /> Add Workout
            </button>
          </div>

          {/* Activities list render */}
          {activities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {activities.map((act) => (
                <div key={act.activityId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{act.type}</strong>
                    <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {act.durationMinutes} mins • {act.intensity} Intensity
                    </span>
                  </div>
                  <button type="button" onClick={() => handleDeleteActivity(act.activityId)} style={{ background: 'none', border: 'none', color: 'var(--color-alert)', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Submission Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '200px' }} disabled={submitLoading}>
            {submitLoading ? <div className="spinner" style={{ width: '18px', height: '18px' }}></div> : 'Save Daily Log'}
          </button>
        </div>
      </form>
    </div>
  );
}
