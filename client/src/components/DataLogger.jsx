import React, { useState } from 'react';
import { Plus, Trash, CheckCircle, AlertTriangle, Sparkles, Edit3 } from 'lucide-react';

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
    <div className="panel-container" style={{ maxWidth: '800px' }}>
      
      {/* Page Header */}
      <div>
        <h2 className="panel-header-title">Daily Logger</h2>
        <p className="panel-header-sub">Record your metrics, meals, and workouts for a healthy lifestyle track.</p>
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
        <div className="alert-banner warning">
          <AlertTriangle size={18} className="text-amber" />
          <div className="flex-col gap-1">
            {warnings.map((w, idx) => (
              <span key={idx}>{w}</span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-col gap-8">
        
        {/* SECTION 1: Core Metrics Grid */}
        <div className="auth-card max-w-none card-padded">
          <h3 className="panel-title text-white mb-6 pb-3" style={{ fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            1. Core Health Metrics
          </h3>
          
          <div className="grid-metrics">
            <div className="auth-input-group">
              <label htmlFor="log-date" className="auth-label">Log Date</label>
              <div className="auth-input-wrapper">
                <input
                  id="log-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="auth-input input-dark-scheme"
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label htmlFor="weight-input" className="auth-label">Current Weight (kg)</label>
              <input
                id="weight-input"
                type="number"
                step="any"
                min="1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 70.5"
                className="auth-input"
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="height-input" className="auth-label">Current Height (cm)</label>
              <input
                id="height-input"
                type="number"
                step="any"
                min="1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 175"
                className="auth-input"
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="sleep-input" className="auth-label">Sleep Duration (hrs)</label>
              <input
                id="sleep-input"
                type="number"
                step="any"
                min="0"
                max="24"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder="e.g. 7.5"
                className="auth-input"
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="mood-select" className="auth-label">Mood Score (1-10)</label>
              <select id="mood-select" value={moodScore} onChange={(e) => setMoodScore(e.target.value)} className="auth-select">
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div className="auth-input-group">
              <label htmlFor="energy-select" className="auth-label">Energy Level (1-10)</label>
              <select id="energy-select" value={energyScore} onChange={(e) => setEnergyScore(e.target.value)} className="auth-select">
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: Workouts Logger */}
        <div className="auth-card max-w-none card-padded">
          <h3 className="panel-title text-white mb-6 pb-3" style={{ fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            2. Workouts & Activity
          </h3>

          {/* Current Logged Activities List */}
          {activities.length > 0 && (
            <div className="flex-col gap-3 mb-6">
              {activities.map((act, index) => (
                <div key={act.type || index} className="item-row-card p-3">
                  <div>
                    <strong className="text-emerald">{act.type}</strong> — {act.durationMinutes} mins 
                    {act.quantity && ` (${act.quantity} ${act.unit})`}
                    <span className={`badge ${act.intensity === 'High' ? 'badge-danger' : act.intensity === 'Medium' ? 'badge-amber' : 'badge-primary'} ml-2`}>
                      {act.intensity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeActivity(index)}
                    className="btn-danger p-1"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Activity Sub-form */}
          <div className="followup-container flex-col gap-4">
            <div className="grid-metrics">
              <div className="auth-input-group m-0">
                <label className="auth-label">Workout Type</label>
                <input
                  type="text"
                  value={newActivity.type}
                  onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                  placeholder="e.g. Walking"
                  className="auth-input"
                />
              </div>

              <div className="auth-input-group m-0">
                <label className="auth-label">Duration (mins)</label>
                <input
                  type="number"
                  min="1"
                  value={newActivity.durationMinutes}
                  onChange={(e) => setNewActivity({ ...newActivity, durationMinutes: e.target.value })}
                  placeholder="e.g. 30"
                  className="auth-input"
                />
              </div>

              <div className="auth-input-group m-0">
                <label className="auth-label">Quantity (Optional)</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={newActivity.quantity}
                  onChange={(e) => setNewActivity({ ...newActivity, quantity: e.target.value })}
                  placeholder="e.g. 10000"
                  className="auth-input"
                />
              </div>

              <div className="auth-input-group m-0">
                <label className="auth-label">Unit (Optional)</label>
                <select
                  value={newActivity.unit}
                  onChange={(e) => setNewActivity({ ...newActivity, unit: e.target.value })}
                  className="auth-select"
                >
                  <option value="steps">steps</option>
                  <option value="reps">reps</option>
                  <option value="km">km</option>
                  <option value="miles">miles</option>
                  <option value="rounds">rounds</option>
                </select>
              </div>

              <div className="auth-input-group m-0">
                <label className="auth-label">Intensity</label>
                <select
                  value={newActivity.intensity}
                  onChange={(e) => setNewActivity({ ...newActivity, intensity: e.target.value })}
                  className="auth-select"
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
              className="auth-submit-btn btn-auto-width"
            >
              <Plus size={16} /> Add Workout
            </button>
          </div>
        </div>

        {/* SECTION 3: Meals & Food Items Logger (V4 Dual Mode) */}
        <div className="auth-card max-w-none card-padded">
          <div className="card-header-flex pb-3 mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="panel-title text-white m-0" style={{ fontSize: '1.1rem' }}>
              3. Meal & Calorie Intake
            </h3>

            {/* V4 Mode Switcher Button Group */}
            <div className="btn-toggle-group">
              <button
                type="button"
                onClick={() => setMealInputMode('text')}
                className={`btn-toggle-item ${mealInputMode === 'text' ? 'active' : ''}`}
              >
                <Sparkles size={14} /> AI Text Extractor
              </button>
              <button
                type="button"
                onClick={() => setMealInputMode('structured')}
                className={`btn-toggle-item ${mealInputMode === 'structured' ? 'active' : ''}`}
              >
                <Plus size={14} /> Direct Structured Mode
              </button>
            </div>
          </div>

          {/* Current Logged Meals List */}
          {meals.length > 0 && (
            <div className="flex-col gap-4 mb-6">
              {meals.map((meal, index) => {
                const mealCals = (meal.items || []).reduce((sum, item) => sum + item.calories, 0);
                return (
                  <div key={meal.textInput || index} className="item-row-card flex-col p-4">
                    <div className="flex-between mb-2 pb-2" style={{ borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
                      <div className="flex-row gap-2">
                        <strong className="text-cyan">{meal.textInput}</strong>
                        {meal.isUserCorrected && (
                          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                            User Corrected
                          </span>
                        )}
                        {meal.isAiUncertain && (
                          <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                            AI Uncertain
                          </span>
                        )}
                      </div>
                      <div className="flex-row gap-3">
                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>{mealCals} kcal</span>
                        <button
                          type="button"
                          onClick={() => removeMeal(index)}
                          className="btn-danger p-1"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-row flex-wrap gap-2">
                      {(meal.items || []).map((item, idx) => (
                        <div key={idx} className="mesh-badge">
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
            <div className="followup-container flex-col gap-5">
              <div className="auth-input-group m-0">
                <label className="auth-label flex-between">
                  <span>Describe Your Meal (Natural Language Text)</span>
                  <span className="text-subtle" style={{ fontSize: '0.75rem' }}>Powered by External REST API (Open Food Facts / USDA)</span>
                </label>
                <textarea
                  rows={2}
                  value={freeTextMeal}
                  onChange={(e) => setFreeTextMeal(e.target.value)}
                  placeholder="e.g. Had 2 Rotis with Dal Makhani, 1 cup Rice, and Black Coffee for lunch"
                  className="auth-input retro-textarea-custom"
                />
              </div>

              <button
                type="button"
                onClick={handleExtractMeal}
                className="auth-submit-btn btn-auto-width"
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
                <div className="rec-card rec-sleep mt-1 p-5">
                  <div className="flex-between">
                    <div className="flex-row gap-2">
                      <Edit3 size={16} className="text-emerald" />
                      <strong className="text-white" style={{ fontSize: '0.95rem' }}>Review & Edit Parsed Items</strong>
                    </div>
                    {extractedData.isUserCorrected && (
                      <span className="badge-version">
                        ✍️ Modified by user (will record UserCorrection audit)
                      </span>
                    )}
                  </div>

                  {extractedData.isAiUncertain && (
                    <div className="alert-banner warning m-0">
                      ⚠️ AI Uncertainty Flag: One or more food items were ambiguous or returned standard defaults. Please verify calories and macros below.
                    </div>
                  )}

                  {/* Interactive Editable Grid */}
                  <div className="flex-col gap-2">
                    {extractedData.items.map((item, index) => (
                      <div key={index} className="flex-row gap-2 items-center">
                        <input
                          type="text"
                          value={item.foodItem}
                          onChange={(e) => handleExtractedItemChange(index, 'foodItem', e.target.value)}
                          className="auth-input"
                        />
                        <input
                          type="number"
                          value={item.calories}
                          onChange={(e) => handleExtractedItemChange(index, 'calories', e.target.value)}
                          className="auth-input"
                        />
                        <input
                          type="number"
                          value={item.protein}
                          onChange={(e) => handleExtractedItemChange(index, 'protein', e.target.value)}
                          className="auth-input"
                        />
                        <input
                          type="number"
                          value={item.carbs}
                          onChange={(e) => handleExtractedItemChange(index, 'carbs', e.target.value)}
                          className="auth-input"
                        />
                        <input
                          type="number"
                          value={item.fats}
                          onChange={(e) => handleExtractedItemChange(index, 'fats', e.target.value)}
                          className="auth-input"
                        />
                        <button
                          type="button"
                          onClick={() => removeExtractedItemRow(index)}
                          className="btn-danger p-2"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex-row gap-4 mt-2">
                    <button
                      type="button"
                      onClick={addExtractedItemRow}
                      className="btn-secondary"
                    >
                      + Add Custom Row
                    </button>

                    <button
                      type="button"
                      onClick={handleAddExtractedMeal}
                      className="auth-submit-btn btn-auto-width"
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
            <div className="followup-container flex-col gap-4">
              <div className="auth-input-group m-0">
                <label htmlFor="structured-meal-name" className="auth-label">Meal Name</label>
                <input
                  id="structured-meal-name"
                  type="text"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  placeholder="e.g. Lunch (Chicken Salad)"
                  className="auth-input"
                />
              </div>

              <div className="flex-col gap-3">
                <label className="auth-label m-0">Food Items & Nutrition Data</label>
                
                {newMealItems.map((item, index) => (
                  <div key={index} className="flex-row gap-2 items-center">
                    <input
                      type="text"
                      value={item.foodItem}
                      onChange={(e) => handleMealItemChange(index, 'foodItem', e.target.value)}
                      placeholder="Food Item (e.g. Oatmeal)"
                      className="auth-input"
                    />
                    <input
                      type="number"
                      value={item.calories}
                      onChange={(e) => handleMealItemChange(index, 'calories', e.target.value)}
                      placeholder="Kcal"
                      className="auth-input"
                    />
                    <input
                      type="number"
                      value={item.protein}
                      onChange={(e) => handleMealItemChange(index, 'protein', e.target.value)}
                      placeholder="Prot (g)"
                      className="auth-input"
                    />
                    <input
                      type="number"
                      value={item.carbs}
                      onChange={(e) => handleMealItemChange(index, 'carbs', e.target.value)}
                      placeholder="Carb (g)"
                      className="auth-input"
                    />
                    <input
                      type="number"
                      value={item.fats}
                      onChange={(e) => handleMealItemChange(index, 'fats', e.target.value)}
                      placeholder="Fat (g)"
                      className="auth-input"
                    />
                    {newMealItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMealItemRow(index)}
                        className="btn-danger p-2"
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex-row gap-4">
                <button
                  type="button"
                  onClick={addMealItemRow}
                  className="btn-secondary"
                >
                  + Add Item Row
                </button>
                <button
                  type="button"
                  onClick={handleAddMeal}
                  className="auth-submit-btn btn-auto-width"
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
          className="auth-submit-btn p-4 text-bold"
          style={{ fontSize: '1rem' }}
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
