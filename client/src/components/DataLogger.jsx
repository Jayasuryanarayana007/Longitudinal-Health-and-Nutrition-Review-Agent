import React, { useState } from 'react';
import { Plus, Trash, Calendar, Info, CheckCircle, AlertTriangle, Sparkles, Edit3 } from 'lucide-react';

export default function DataLogger({ currentUser }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [moodScore, setMoodScore] = useState('7');
  const [energyScore, setEnergyScore] = useState('7');

  // Nested arrays for dynamic tracking
  const [meals, setMeals] = useState([]);
  const [activities, setActivities] = useState([]);

  // Form states for adding items
  const [newMealName, setNewMealName] = useState('');
  const [newMealItems, setNewMealItems] = useState([{ foodItem: '', calories: '', protein: '', carbs: '', fats: '' }]);

  const [newActivity, setNewActivity] = useState({
    type: '',
    durationMinutes: '',
    quantity: '',
    unit: 'reps',
    intensity: 'Medium'
  });

  // V4 Meal Extraction States
  const [mealInputMode, setMealInputMode] = useState('text'); // 'text' or 'structured'
  const [freeTextMeal, setFreeTextMeal] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null); // { textInput, items, aiEstimates, isAiUncertain, isUserCorrected }

  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  // Meal item row management
  const handleMealItemChange = (index, field, val) => {
    const updated = [...newMealItems];
    updated[index][field] = val;
    setNewMealItems(updated);
  };

  const addMealItemRow = () => {
    setNewMealItems([...newMealItems, { foodItem: '', calories: '', protein: '', carbs: '', fats: '' }]);
  };

  const removeMealItemRow = (index) => {
    const updated = [...newMealItems];
    updated.splice(index, 1);
    setNewMealItems(updated);
  };

  // V4: External REST API Meal Extraction Handler
  const handleExtractMeal = async () => {
    if (!freeTextMeal.trim()) return;
    setExtracting(true);
    setError(null);

    try {
      const response = await fetch('/api/logs/extract-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textInput: freeTextMeal.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to extract nutrition data from text.');
      }

      setExtractedData({
        textInput: freeTextMeal.trim(),
        items: data.items || [],
        aiEstimates: JSON.parse(JSON.stringify(data.items || [])), // deep copy of original AI output
        isAiUncertain: data.isAiUncertain || false,
        isUserCorrected: false
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractedItemChange = (index, field, val) => {
    if (!extractedData) return;
    const updatedItems = [...extractedData.items];
    updatedItems[index][field] = field === 'foodItem' ? val : parseFloat(val) || 0;
    setExtractedData({
      ...extractedData,
      items: updatedItems,
      isUserCorrected: true
    });
  };

  const addExtractedItemRow = () => {
    if (!extractedData) return;
    setExtractedData({
      ...extractedData,
      items: [...extractedData.items, { foodItem: '', calories: 0, protein: 0, carbs: 0, fats: 0 }],
      isUserCorrected: true
    });
  };

  const removeExtractedItemRow = (index) => {
    if (!extractedData) return;
    const updated = [...extractedData.items];
    updated.splice(index, 1);
    setExtractedData({
      ...extractedData,
      items: updated,
      isUserCorrected: true
    });
  };

  const handleAddExtractedMeal = () => {
    if (!extractedData || extractedData.items.length === 0) return;
    setMeals([...meals, {
      textInput: extractedData.textInput,
      items: extractedData.items,
      aiEstimates: extractedData.aiEstimates,
      isUserCorrected: extractedData.isUserCorrected,
      isAiUncertain: extractedData.isAiUncertain
    }]);

    setFreeTextMeal('');
    setExtractedData(null);
  };

  const handleAddMeal = (e) => {
    e.preventDefault();
    if (!newMealName.trim()) return;

    // Filter and sanitize items
    const items = newMealItems
      .filter(item => item.foodItem.trim())
      .map(item => ({
        foodItem: item.foodItem.trim(),
        calories: parseFloat(item.calories) || 0,
        protein: parseFloat(item.protein) || 0,
        carbs: parseFloat(item.carbs) || 0,
        fats: parseFloat(item.fats) || 0
      }));

    if (items.length === 0) return;

    setMeals([...meals, { textInput: newMealName.trim(), items }]);
    setNewMealName('');
    setNewMealItems([{ foodItem: '', calories: '', protein: '', carbs: '', fats: '' }]);
  };

  const removeMeal = (index) => {
    const updated = [...meals];
    updated.splice(index, 1);
    setMeals(updated);
  };

  // Activity management
  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!newActivity.type.trim() || !newActivity.durationMinutes) return;

    setActivities([...activities, {
      type: newActivity.type.trim(),
      durationMinutes: parseInt(newActivity.durationMinutes) || 0,
      quantity: newActivity.quantity ? parseFloat(newActivity.quantity) : null,
      unit: newActivity.unit.trim(),
      intensity: newActivity.intensity
    }]);

    setNewActivity({
      type: '',
      durationMinutes: '',
      quantity: '',
      unit: 'reps',
      intensity: 'Medium'
    });
  };

  const removeActivity = (index) => {
    const updated = [...activities];
    updated.splice(index, 1);
    setActivities(updated);
  };

  // Submit daily logs to the backend database
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setWarnings([]);
    setSuccess(null);

    // Client-side pre-validation for blocking inconsistency rules
    const sleepVal = sleepHours ? parseFloat(sleepHours) : null;
    const energyVal = parseInt(energyScore);

    // Rule 1: Sleep < 3h AND Energy >= 9 -> BLOCKING
    if (sleepVal !== null && sleepVal < 3.0 && energyVal >= 9) {
      setError('Paradoxical Energy Warning: Logged sleep duration is under 3 hours (<3h) but Energy Score is reported at 9 or higher (≥9). Please verify your entry before submitting.');
      return;
    }

    // Rule 2: Active mins > 120m AND Calories < 1000 -> BLOCKING
    const totalActivityMins = activities.reduce((sum, a) => sum + (parseInt(a.durationMinutes) || 0), 0);
    const totalCalories = meals.reduce((sum, m) => {
      const itemsCals = (m.items || []).reduce((s, item) => s + (parseFloat(item.calories) || 0), 0);
      return sum + itemsCals;
    }, 0);

    if (totalActivityMins > 120 && totalCalories > 0 && totalCalories < 1000) {
      setError('Extreme Calorie Deficit Warning: Total active workout duration exceeds 120 minutes while daily calorie intake is under 1000 kcal. Please verify your entries.');
      return;
    }

    setLoading(true);

    const payload = {
      username: currentUser.username,
      date,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      sleepHours: sleepHours ? parseFloat(sleepHours) : null,
      moodScore: parseInt(moodScore) || null,
      energyScore: parseInt(energyScore) || null,
      meals,
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
        throw new Error(data.message || 'Failed to save daily logs.');
      }

      setSuccess('Daily logs submitted successfully!');
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings);
      }

      // Clear all form fields to prevent stale re-submissions
      setWeight('');
      setHeight('');
      setSleepHours('');
      setMoodScore('7');
      setEnergyScore('7');
      setMeals([]);
      setActivities([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#f8fafc' }}>Daily Logger</h2>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>Record your metrics, meals, and workouts for a healthy lifestyle track.</p>
      </div>

      {/* Success/Error Alerts */}
      {success && (
        <div className="alert-banner success">
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="alert-banner danger">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      {warnings && warnings.length > 0 && (
        <div className="alert-banner warning" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b', color: '#fbbf24' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {warnings.map((w, idx) => (
              <span key={idx}>{w}</span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* SECTION 1: Core Metrics Grid */}
        <div className="auth-card" style={{ maxWidth: 'none', padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', color: '#f8fafc' }}>
            1. Core Health Metrics
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div className="auth-input-group">
              <label className="auth-label">Log Date</label>
              <div className="auth-input-wrapper">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="auth-input"
                  style={{ paddingLeft: '1rem', colorScheme: 'dark' }}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Current Weight (kg)</label>
              <input
                type="number"
                step="any"
                min="1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 70.5"
                className="auth-input"
                style={{ paddingLeft: '1rem' }}
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Current Height (cm)</label>
              <input
                type="number"
                step="any"
                min="1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 175"
                className="auth-input"
                style={{ paddingLeft: '1rem' }}
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Sleep Duration (hrs)</label>
              <input
                type="number"
                step="any"
                min="0"
                max="24"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder="e.g. 7.5"
                className="auth-input"
                style={{ paddingLeft: '1rem' }}
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Mood Score (1-10)</label>
              <select value={moodScore} onChange={(e) => setMoodScore(e.target.value)} className="auth-select" style={{ paddingLeft: '1rem' }}>
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Energy Level (1-10)</label>
              <select value={energyScore} onChange={(e) => setEnergyScore(e.target.value)} className="auth-select" style={{ paddingLeft: '1rem' }}>
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: Workouts Logger */}
        <div className="auth-card" style={{ maxWidth: 'none', padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', color: '#f8fafc' }}>
            2. Workouts & Activity
          </h3>

          {/* Current Logged Activities List */}
          {activities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {activities.map((act, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.4)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div>
                    <strong style={{ color: '#10b981' }}>{act.type}</strong> — {act.durationMinutes} mins 
                    {act.quantity && ` (${act.quantity} ${act.unit})`}
                    <span style={{
                      marginLeft: '0.75rem',
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      background: act.intensity === 'High' ? 'rgba(239, 68, 68, 0.15)' : act.intensity === 'Medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: act.intensity === 'High' ? '#f87171' : act.intensity === 'Medium' ? '#fbbf24' : '#34d399'
                    }}>{act.intensity}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeActivity(index)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Activity Sub-form */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.2)',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label className="auth-label">Workout Type</label>
                <input
                  type="text"
                  value={newActivity.type}
                  onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                  placeholder="e.g. Walking"
                  className="auth-input"
                  style={{ paddingLeft: '0.75rem' }}
                />
              </div>

              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label className="auth-label">Duration (mins)</label>
                <input
                  type="number"
                  min="1"
                  value={newActivity.durationMinutes}
                  onChange={(e) => setNewActivity({ ...newActivity, durationMinutes: e.target.value })}
                  placeholder="e.g. 30"
                  className="auth-input"
                  style={{ paddingLeft: '0.75rem' }}
                />
              </div>

              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label className="auth-label">Quantity (Optional)</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={newActivity.quantity}
                  onChange={(e) => setNewActivity({ ...newActivity, quantity: e.target.value })}
                  placeholder="e.g. 10000"
                  className="auth-input"
                  style={{ paddingLeft: '0.75rem' }}
                />
              </div>

              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label className="auth-label">Unit (Optional)</label>
                <select
                  value={newActivity.unit}
                  onChange={(e) => setNewActivity({ ...newActivity, unit: e.target.value })}
                  className="auth-select"
                  style={{ paddingLeft: '0.75rem' }}
                >
                  <option value="steps">steps</option>
                  <option value="reps">reps</option>
                  <option value="km">km</option>
                  <option value="miles">miles</option>
                  <option value="rounds">rounds</option>
                </select>
              </div>

              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label className="auth-label">Intensity</label>
                <select
                  value={newActivity.intensity}
                  onChange={(e) => setNewActivity({ ...newActivity, intensity: e.target.value })}
                  className="auth-select"
                  style={{ paddingLeft: '0.75rem' }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddActivity}
              className="auth-submit-btn"
              style={{ width: 'fit-content', marginTop: 0, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} /> Add Workout
            </button>
          </div>
        </div>

        {/* SECTION 3: Meals & Food Items Logger (V4 Dual Mode) */}
        <div className="auth-card" style={{ maxWidth: 'none', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#f8fafc' }}>
              3. Meal & Calorie Intake
            </h3>

            {/* V4 Mode Switcher Button Group */}
            <div style={{ display: 'flex', background: '#151d30', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setMealInputMode('text')}
                style={{
                  background: mealInputMode === 'text' ? '#10b981' : 'transparent',
                  color: mealInputMode === 'text' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Sparkles size={14} /> AI Text Extractor
              </button>
              <button
                type="button"
                onClick={() => setMealInputMode('structured')}
                style={{
                  background: mealInputMode === 'structured' ? '#10b981' : 'transparent',
                  color: mealInputMode === 'structured' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Plus size={14} /> Direct Structured Mode
              </button>
            </div>
          </div>

          {/* Current Logged Meals List */}
          {meals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {meals.map((meal, index) => {
                const mealCals = (meal.items || []).reduce((sum, item) => sum + item.calories, 0);
                return (
                  <div key={index} style={{
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px dashed rgba(255,255,255,0.04)', paddingBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: '#06b6d4', fontSize: '0.95rem' }}>{meal.textInput}</strong>
                        {meal.isUserCorrected && (
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                            User Corrected
                          </span>
                        )}
                        {meal.isAiUncertain && (
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                            AI Uncertain
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{mealCals} kcal</span>
                        <button
                          type="button"
                          onClick={() => removeMeal(index)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {(meal.items || []).map((item, idx) => (
                        <div key={idx} style={{
                          fontSize: '0.8rem',
                          background: 'rgba(255,255,255,0.04)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '4px',
                          color: '#e2e8f0'
                        }}>
                          {item.foodItem} ({item.calories}c, P:{item.protein}g, C:{item.carbs}g, F:{item.fats}g)
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODE 1: Text-Based AI Extractor */}
          {mealInputMode === 'text' && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.2)',
              padding: '1.25rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label className="auth-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Describe Your Meal (Natural Language Text)</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Powered by External REST API (Open Food Facts / USDA)</span>
                </label>
                <textarea
                  rows={2}
                  value={freeTextMeal}
                  onChange={(e) => setFreeTextMeal(e.target.value)}
                  placeholder="e.g. Had 2 Rotis with Dal Makhani, 1 cup Rice, and Black Coffee for lunch"
                  className="auth-input"
                  style={{ padding: '0.75rem', height: 'auto', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <button
                type="button"
                onClick={handleExtractMeal}
                className="auth-submit-btn"
                style={{ width: 'fit-content', marginTop: 0, padding: '0.65rem 1.4rem', fontSize: '0.85rem' }}
                disabled={extracting || !freeTextMeal.trim()}
              >
                {extracting ? (
                  <div className="spinner"></div>
                ) : (
                  <>
                    <Sparkles size={16} /> Extract Nutrition Data
                  </>
                )}
              </button>

              {/* Extracted Review & Override Card */}
              {extractedData && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  marginTop: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Edit3 size={16} style={{ color: '#10b981' }} />
                      <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>Review & Edit Parsed Items</strong>
                    </div>
                    {extractedData.isUserCorrected && (
                      <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>
                        ✍️ Modified by user (will record UserCorrection audit)
                      </span>
                    )}
                  </div>

                  {extractedData.isAiUncertain && (
                    <div style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      ⚠️ AI Uncertainty Flag: One or more food items were ambiguous or returned standard defaults. Please verify calories and macros below.
                    </div>
                  )}

                  {/* Interactive Editable Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {extractedData.items.map((item, index) => (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={item.foodItem}
                          onChange={(e) => handleExtractedItemChange(index, 'foodItem', e.target.value)}
                          className="auth-input"
                          style={{ paddingLeft: '0.75rem' }}
                        />
                        <input
                          type="number"
                          value={item.calories}
                          onChange={(e) => handleExtractedItemChange(index, 'calories', e.target.value)}
                          className="auth-input"
                          style={{ paddingLeft: '0.75rem' }}
                        />
                        <input
                          type="number"
                          value={item.protein}
                          onChange={(e) => handleExtractedItemChange(index, 'protein', e.target.value)}
                          className="auth-input"
                          style={{ paddingLeft: '0.75rem' }}
                        />
                        <input
                          type="number"
                          value={item.carbs}
                          onChange={(e) => handleExtractedItemChange(index, 'carbs', e.target.value)}
                          className="auth-input"
                          style={{ paddingLeft: '0.75rem' }}
                        />
                        <input
                          type="number"
                          value={item.fats}
                          onChange={(e) => handleExtractedItemChange(index, 'fats', e.target.value)}
                          className="auth-input"
                          style={{ paddingLeft: '0.75rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeExtractedItemRow(index)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={addExtractedItemRow}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Custom Row
                    </button>

                    <button
                      type="button"
                      onClick={handleAddExtractedMeal}
                      className="auth-submit-btn"
                      style={{ width: 'fit-content', marginTop: 0, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                    >
                      <CheckCircle size={16} /> Add Extracted Meal to Daily Log
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: Direct Structured Mode */}
          {mealInputMode === 'structured' && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.2)',
              padding: '1.25rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div className="auth-input-group" style={{ marginBottom: 0 }}>
                <label className="auth-label">Meal Name</label>
                <input
                  type="text"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  placeholder="e.g. Lunch (Chicken Salad)"
                  className="auth-input"
                  style={{ paddingLeft: '0.75rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="auth-label">Food Items & Nutrition Data</label>
                
                {newMealItems.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={item.foodItem}
                      onChange={(e) => handleMealItemChange(index, 'foodItem', e.target.value)}
                      placeholder="Food Item (e.g. Oatmeal)"
                      className="auth-input"
                      style={{ paddingLeft: '0.75rem' }}
                    />
                    <input
                      type="number"
                      value={item.calories}
                      onChange={(e) => handleMealItemChange(index, 'calories', e.target.value)}
                      placeholder="Kcal"
                      className="auth-input"
                      style={{ paddingLeft: '0.75rem' }}
                    />
                    <input
                      type="number"
                      value={item.protein}
                      onChange={(e) => handleMealItemChange(index, 'protein', e.target.value)}
                      placeholder="Prot (g)"
                      className="auth-input"
                      style={{ paddingLeft: '0.75rem' }}
                    />
                    <input
                      type="number"
                      value={item.carbs}
                      onChange={(e) => handleMealItemChange(index, 'carbs', e.target.value)}
                      placeholder="Carb (g)"
                      className="auth-input"
                      style={{ paddingLeft: '0.75rem' }}
                    />
                    <input
                      type="number"
                      value={item.fats}
                      onChange={(e) => handleMealItemChange(index, 'fats', e.target.value)}
                      placeholder="Fat (g)"
                      className="auth-input"
                      style={{ paddingLeft: '0.75rem' }}
                    />
                    {newMealItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMealItemRow(index)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={addMealItemRow}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  + Add Item Row
                </button>
                <button
                  type="button"
                  onClick={handleAddMeal}
                  className="auth-submit-btn"
                  style={{ width: 'fit-content', marginTop: 0, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                >
                  <Plus size={16} /> Add Meal to Log
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Submit Logs Button */}
        <button
          type="submit"
          className="auth-submit-btn"
          style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: '700' }}
          disabled={loading}
        >
          {loading ? (
            <div className="spinner"></div>
          ) : (
            'Submit Daily Entry'
          )}
        </button>

      </form>
    </div>
  );
}
