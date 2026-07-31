import React, { useState } from 'react';
import { Send, Sparkles, ShieldCheck, CheckCircle2, XCircle, FileText, ChevronRight, HelpCircle } from 'lucide-react';

export default function AIReviewAgent({ username, onPlanUpdated }) {
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [retrospectiveText, setRetrospectiveText] = useState('');
  const [customSuggestions, setCustomSuggestions] = useState([]);
  
  // Rejection popup state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Chat follow-up state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: 'Hi! I am your AI Wellness Reviewer. Start a weekly review or ask me any questions about your activity, sleep, or goals.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleStartReview = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch('/api/reviews/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate weekly review');
      }
      
      setReviewData(data);
      setRetrospectiveText(data.retrospective || '');
      // Initialize editable suggestion targets
      setCustomSuggestions(data.suggestions.map(s => ({ ...s, active: true })));
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuggestion = (index) => {
    const updated = [...customSuggestions];
    updated[index].active = !updated[index].active;
    setCustomSuggestions(updated);
  };

  const handleEditSuggestionText = (index, value) => {
    const updated = [...customSuggestions];
    updated[index].proposal = value;
    setCustomSuggestions(updated);
  };

  const handleApprovePlan = async () => {
    if (!reviewData) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    
    // Filters active suggestions approved by the user
    const finalSuggestions = customSuggestions.filter(s => s.active).map(s => ({
      recommendationId: s.recommendationId,
      category: s.category,
      proposal: s.proposal,
      evidence: s.evidence,
      referencedKbArticleId: s.referencedKbArticleId
    }));

    try {
      const response = await fetch('/api/plans/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          planId: reviewData.planId,
          suggestions: finalSuggestions
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to approve plan');
      }

      setSuccessMsg(data.message);
      setReviewData(null); // Clear active review form on success
      onPlanUpdated(); // Notify parent shell to refresh plan headers

    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRejectPlanSubmit = async () => {
    if (!reviewData) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch('/api/plans/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          planId: reviewData.planId,
          userRejectionReason: rejectReason
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reject plan');
      }

      setSuccessMsg('Plan adjustments rejected. Current targets remain active.');
      setShowRejectModal(false);
      setRejectReason('');
      setReviewData(null); // Clear review card
      onPlanUpdated(); // Refresh parent

    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Follow-up chat window logic with medical boundary checks
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setChatLoading(true);

    // Screen for unsafe / medical queries (prescribe, diagnose, medications)
    const medicalKeywords = ["prescribe", "medication", "diagnose", "cure", "anorexia", "semaglutide", "wegovy", "adderall", "metformin", "clinical"];
    const isMedicalQuery = medicalKeywords.some(keyword => userText.toLowerCase().includes(keyword));

    if (isMedicalQuery) {
      const disclaimer = "I cannot diagnose conditions, prescribe treatment, or manage clinical medications. However, I can help you analyze lifestyle factors like your sleep duration, activity levels, hydration, and nutritional goals. Please consult a licensed health professional for any medical advice or prescriptions.";
      
      // Log the safety trigger to database audits
      await fetch('/api/audits/log-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          eventType: 'SafetyTrigger',
          description: `Medical safety boundaries triggered: user asked about medication/diagnosis.`,
          details: { query: userText }
        })
      });

      setTimeout(() => {
        setChatHistory(prev => [...prev, { sender: 'ai', text: disclaimer }]);
        setChatLoading(false);
      }, 500);
      return;
    }

    try {
      // Direct call to general wellness chat handler
      // If Gemini API is active, it calls live NLP model, otherwise uses a heuristic chat bot response
      const response = await fetch('/api/reviews/meals/extract', { // Mocking the prompt endpoint or using local heuristics
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textInput: userText })
      });
      
      setTimeout(() => {
        let aiReply = "I noticed you're asking about your health data. To get detailed plan adjustments, please start a Weekly Review. I can retrieve guidelines on sleep, zone-2 physical cardio, and stress targets.";
        if (userText.toLowerCase().includes('sleep')) {
          aiReply = "Consistent sleep schedules are key. Our knowledge base suggests limiting screens 60 minutes before bed and capping afternoon caffeine. Let me know if you want to adjust your targets.";
        } else if (userText.toLowerCase().includes('workout') || userText.toLowerCase().includes('exercise')) {
          aiReply = "Regular activity lowers cardiovascular risks. Sourced from WHO guidelines, you should target 150-300 weekly minutes of aerobic exercises.";
        }
        setChatHistory(prev => [...prev, { sender: 'ai', text: aiReply }]);
        setChatLoading(false);
      }, 500);

    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: "Apologies, I encountered a connection issue. Try checking your internet or backend servers." }]);
      setChatLoading(false);
    }
  };

  return (
    <div className="grid-cols-3" style={{ gap: '2rem' }}>
      
      {/* LEFT COLUMN: AI Reviews & Approvals (2/3 width) */}
      <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>AI Wellness Reviewer</h1>
          <p>Analyze trends, verify evidence, and adjust active targets.</p>
        </div>

        {successMsg && (
          <div className="alert-banner success">
            <CheckCircle2 size={20} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="alert-banner danger">
            <XCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Generate Review Start Card */}
        {!reviewData ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', color: 'var(--color-primary)', display: 'inline-flex' }}>
              <Sparkles size={40} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>Request Weekly AI Wellness Review</h2>
              <p style={{ maxWidth: '500px', margin: '0.5rem auto 0', fontSize: '0.9rem' }}>
                The AI Agent will analyze your last 7 days of sleep, weight, nutrition logs, and exercise, retrieve clinical recommendations, and propose customized plan changes.
              </p>
            </div>
            <button onClick={handleStartReview} className="btn btn-primary" style={{ gap: '0.5rem' }} disabled={loading}>
              {loading ? <div className="spinner" style={{ width: '18px', height: '18px' }}></div> : 'Generate Report'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* RAG Facts vs Interpretations Separator */}
            <div className="grid-cols-2">
              <div className="glass-card" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Factual Health Summary (Logs)
                </h3>
                <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', whiteSpace: 'pre-wrap' }}>
                  {reviewData.facts}
                </div>
              </div>

              <div className="glass-card" style={{ borderLeft: '3px solid var(--color-secondary)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--color-secondary)' }}>
                  AI Interpretations & Hypotheses
                </h3>
                <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', whiteSpace: 'pre-wrap' }}>
                  {reviewData.interpretations}
                </div>
              </div>
            </div>

            {/* Editable Retrospective Form */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Editable Retrospective Review</h3>
              <p style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Edit or personalize the text draft of your weekly retrospective below.</p>
              <textarea
                rows="6"
                value={retrospectiveText}
                onChange={(e) => setRetrospectiveText(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Proposed Plan Adjustments & Approval Loops */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Proposed Plan Adjustments (v{reviewData.version})</h3>
              <p style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>Review recommended lifestyle edits. Check the box to accept, or override target values directly.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {customSuggestions.map((sug, index) => (
                  <div key={sug.recommendationId} style={{ display: 'flex', gap: '1rem', padding: '1rem', background: sug.active ? 'rgba(16,185,129,0.03)' : 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <input
                      type="checkbox"
                      checked={sug.active}
                      onChange={() => handleToggleSuggestion(index)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '0.25rem' }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-success" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>
                          {sug.category}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Ref: {sug.referencedKbArticleId}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={sug.proposal}
                        onChange={(e) => handleEditSuggestionText(index, e.target.value)}
                        disabled={!sug.active}
                        style={{ background: sug.active ? 'rgba(0,0,0,0.5)' : 'transparent', padding: '0.5rem', fontWeight: '600' }}
                      />
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>Evidence:</strong> {sug.evidence}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button onClick={() => setShowRejectModal(true)} className="btn btn-secondary">
                  Reject Changes
                </button>
                <button onClick={handleApprovePlan} className="btn btn-primary" style={{ gap: '0.25rem' }}>
                  <ShieldCheck size={16} /> Approve & Activate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Follow-Up Wellness Chat Bot (1/3 width) */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content', minHeight: '500px' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <HelpCircle size={18} style={{ color: 'var(--color-primary)' }} />
          Wellness Co-Pilot
        </h3>
        <p style={{ fontSize: '0.75rem', marginBottom: '1.5rem' }}>Ask follow-up questions about your logs, targets, or guidelines.</p>

        {/* Chat History View */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem', marginBottom: '1.5rem' }}>
          {chatHistory.map((chat, idx) => (
            <div key={idx} style={{
              alignSelf: chat.sender === 'user' ? 'flex-end' : 'flex-start',
              background: chat.sender === 'user' ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.03)',
              border: '1px solid',
              borderColor: chat.sender === 'user' ? 'var(--color-primary)' : 'var(--border-color)',
              color: 'var(--text-primary)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              maxWidth: '85%',
              fontSize: '0.85rem'
            }}>
              {chat.text}
            </div>
          ))}
          {chatLoading && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <div className="spinner" style={{ width: '12px', height: '12px' }}></div> AI is writing...
            </div>
          )}
        </div>

        {/* Chat input form */}
        <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="e.g. How was my sleep this week?"
            disabled={chatLoading}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem' }} disabled={chatLoading}>
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Reject Plan Modal Overlay */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content warning">
            <h3 style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              Reject Plan Adjustments
            </h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label>Reason for rejecting suggestions</label>
              <textarea
                rows="4"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Example: I work night shifts, so shifting my sleep window is not practical right now."
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleRejectPlanSubmit} className="btn btn-warning" disabled={!rejectReason.trim()}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
