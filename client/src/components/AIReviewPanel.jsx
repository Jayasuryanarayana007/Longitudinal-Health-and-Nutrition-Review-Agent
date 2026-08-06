import React, { useState } from 'react';
import { Sparkles, CheckCircle, ShieldAlert, ChevronDown, ChevronUp, BookOpen, XCircle, FileText } from 'lucide-react';
import GoalProfileCard from './GoalProfileCard';
import ActivePlanCard from './ActivePlanCard';

export default function AIReviewPanel({ currentUser, onGoalsUpdated }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [editedRetroText, setEditedRetroText] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [userModified, setUserModified] = useState(false);
  const [followUpAnswers, setFollowUpAnswers] = useState({});

  // UI state for expandable evidence accordions (mapped by recommendation index)
  const [expandedEvidence, setExpandedEvidence] = useState({});

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const toggleEvidence = (index) => {
    setExpandedEvidence(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleGenerateReview = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/plans/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, date, followUpAnswers })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to generate review.');

      setReviewData(data);
      setEditedRetroText(data.retrospectiveText || '');
      setUserSuggestions(data.proposedRecommendations ? JSON.parse(JSON.stringify(data.proposedRecommendations)) : []);
      setUserModified(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSuggestionTargetChange = (index, val) => {
    const updated = [...userSuggestions];
    updated[index].targetValue = parseFloat(val) || 0;
    setUserSuggestions(updated);
    setUserModified(true);
  };

  const handleApprovePlan = async () => {
    if (!reviewData) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/plans/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          planVersion: reviewData.planVersion,
          suggestions: userSuggestions,
          userModified,
          followUpAnswers
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to approve plan.');

      setSuccess(`Plan Version v${reviewData.planVersion} approved and active targets synced!`);
      setReviewData(null);

      // Trigger target auto-sync across Dashboard and Logger
      if (onGoalsUpdated) onGoalsUpdated();

    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPlanSubmit = async (e) => {
    e.preventDefault();
    if (!reviewData) return;
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/plans/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          planVersion: reviewData.planVersion,
          userRejectionReason: rejectionReason.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to record rejection.');

      setSuccess('Plan recommendation declined. Current active goals maintained.');
      setShowRejectModal(false);
      setRejectionReason('');
      setReviewData(null);

    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="panel-container">
      
      {/* Page Header */}
      <div>
        <h2 className="panel-header-title">
          AI Wellness Agent & Plan Versioning
        </h2>
        <p className="panel-header-sub">
          Manage target goals, generate evidence-backed retrospectives, and approve versioned plans.
        </p>
      </div>

      {/* Mandatory Medical Disclaimer Banner */}
      <div className="medical-disclaimer-banner">
        <ShieldAlert size={20} className="text-rose flex-shrink-0" />
        <div>
          <strong className="text-rose-light">Medical & Safety Notice:</strong> This application is an AI-assisted lifestyle & wellness review tool. It does not provide medical diagnosis, prescribe treatments, or guarantee health outcomes. Always consult a licensed physician or healthcare professional for clinical advice.
        </div>
      </div>

      {/* TOP CARD: Active Goals Profile Component */}
      <GoalProfileCard currentUser={currentUser} onGoalsUpdated={onGoalsUpdated} />

      {/* TODAY'S ACTIVE APPROVED PLAN SUMMARY CARD */}
      <ActivePlanCard currentUser={currentUser} refreshTrigger={success} />

      {/* Main Review Section */}
      <div className="auth-card max-w-none card-padded">
        
        {/* Trigger Bar */}
        <div className="card-header-flex">
          <div>
            <h3 className="panel-title text-white m-0" style={{ fontSize: '1.1rem' }}>
              Weekly Review & Retrospective Generator
            </h3>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              Queries RAG Knowledge Base and separates Facts from Interpretations.
            </span>
          </div>

          <div className="flex-row gap-4">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="auth-input input-width-md"
            />

            <button
              type="button"
              onClick={handleGenerateReview}
              className="auth-submit-btn btn-auto-width"
              disabled={generating}
            >
              {generating ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <Sparkles size={16} /> Generate Retrospective & Plan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {success && (
          <div className="alert-banner success mb-6">
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="alert-banner danger mb-6">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* REVIEW RESULTS DISPLAY */}
        {reviewData && (
          <div className="flex-col gap-8 mt-0">
            
            {/* RAG Engine Status Badge */}
            <div className="status-bar">
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>RAG Engine Status:</span>
              {reviewData.llmPowered ? (
                <span className="status-badge-llm">
                  <Sparkles size={13} /> 🤖 Groq LLM RAG (llama-3.3-70b-versatile)
                </span>
              ) : (
                <span className="status-badge-fallback">
                  <CheckCircle size={13} /> ⚡ Local Deterministic Engine
                </span>
              )}
            </div>

            {/* SECTION 1: Facts vs. Interpretations Separator */}
            <div className="grid-2-col">
              {/* FACTS PANEL */}
              <div className="facts-card">
                <h4 className="facts-title">
                  <FileText size={16} /> Factual Statistics (Logged Data)
                </h4>
                <ul className="facts-list">
                  {(reviewData.facts || []).map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>

              {/* INTERPRETATIONS PANEL */}
              <div className="interp-card">
                <h4 className="interp-title">
                  <Sparkles size={16} /> Contextual AI Hypotheses (Interpretations)
                </h4>
                <ul className="facts-list">
                  {(reviewData.interpretations || []).map((interp, idx) => (
                    <li key={idx}>{interp}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SECTION 2: Editable Retrospective Text Block */}
            <div className="retro-edit-card">
              <label htmlFor="retro-text" className="retro-label">
                <span className="retro-label-title">Editable Retrospective Text Narrative</span>
                <span className="retro-label-sub">You can customize this narrative before archiving</span>
              </label>
              <textarea
                id="retro-text"
                rows={3}
                value={editedRetroText}
                onChange={(e) => setEditedRetroText(e.target.value)}
                className="retro-textarea retro-textarea-custom"
              />
            </div>

            {/* SECTION 2.5: Targeted AI Follow-Up Questions */}
            {reviewData.followUpQuestions && reviewData.followUpQuestions.length > 0 && (
              <div className="followup-container">
                <h4 className="followup-title">
                  <Sparkles size={16} /> Targeted AI Follow-Up Questions (Trend Insights)
                </h4>
                <div className="followup-list">
                  {reviewData.followUpQuestions.map((q, idx) => (
                    <div key={idx} className="followup-item">
                      <div>
                        <strong className="text-amber" style={{ marginRight: '0.4rem' }}>Q{idx + 1}:</strong> {q}
                      </div>
                      <input
                        type="text"
                        placeholder="Type your response to refine current plan recommendations..."
                        value={followUpAnswers[idx] || ''}
                        onChange={(e) => setFollowUpAnswers({ ...followUpAnswers, [idx]: e.target.value })}
                        className="auth-input followup-input"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex-end mt-0" style={{ marginTop: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={handleGenerateReview}
                    disabled={generating}
                    className="badge badge-amber btn-auto-width p-2"
                  >
                    <Sparkles size={14} /> {generating ? 'Refine Plan...' : '✨ Refine Current Plan Recommendations with My Answers'}
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 3: Interactive Plan Approval Panel (v1 -> v2) */}
            <div className="auth-card max-w-none p-6 flex-col gap-5" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div className="flex-between">
                <div>
                  <h4 className="panel-title text-white m-0" style={{ fontSize: '1.1rem' }}>
                    Proposed Plan Recommendations (Version v{reviewData.planVersion})
                  </h4>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Every proposal includes evidence from the Knowledge Base. Click the dropdown icon beside any suggestion to view supporting evidence.
                  </span>
                </div>
                {userModified && (
                  <span className="badge-version">
                    ✍️ Targets Modified
                  </span>
                )}
              </div>

              {/* Suggestions List with Expandable Evidence Dropdown Chevrons */}
              <div className="flex-col gap-4">
                {userSuggestions.map((rec, index) => {
                  const isExpanded = !!expandedEvidence[index];
                  return (
                    <div key={rec.category || index} className="rec-card rec-default">
                      <div className="flex-between flex-wrap gap-3">
                        <div className="flex-row gap-2" style={{ flex: 1, minWidth: '220px' }}>
                          
                          {/* Dropdown Chevron Icon Button */}
                          <button
                            type="button"
                            onClick={() => toggleEvidence(index)}
                            title="Toggle Evidence & Knowledge Base Details"
                            className="app-nav-tab p-2"
                            style={{ background: isExpanded ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)', color: isExpanded ? '#34d399' : '#94a3b8' }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          <div>
                            <strong className="text-emerald" style={{ fontSize: '0.9rem' }}>[{rec.category}]</strong>{' '}
                            <span className="text-white" style={{ fontSize: '0.9rem', fontWeight: '500' }}>{rec.proposal}</span>
                          </div>
                        </div>

                        {/* Editable Target Value Input */}
                        <div className="flex-row gap-2">
                          <label className="text-muted" style={{ fontSize: '0.8rem' }}>Target:</label>
                          <input
                            type="number"
                            step="any"
                            value={rec.targetValue || ''}
                            onChange={(e) => handleSuggestionTargetChange(index, e.target.value)}
                            className="auth-input"
                            style={{ width: '90px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      {/* Expandable Scientific Evidence Dropdown Accordion */}
                      {isExpanded && (
                        <div className="evidence-box">
                          <div className="flex-between flex-wrap gap-2">
                            <div className="evidence-title">
                              <BookOpen size={14} /> Clinical Reference: #{rec.kbArticleId || 'RAG-Ref'}
                            </div>
                            {rec.evidenceGrade && (
                              <span className="badge badge-cyan">
                                🧪 {rec.evidenceGrade}
                              </span>
                            )}
                          </div>

                          <div style={{ fontStyle: 'italic', lineHeight: '1.4', color: '#cbd5e1' }}>
                            "{rec.evidence}"
                          </div>

                          {/* Metadata: DOI & MeSH Terms */}
                          <div className="flex-between flex-wrap gap-2 pt-2 mt-1 border-subtle" style={{ fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            {rec.doi && (
                              <span><strong>DOI:</strong> <a href={`https://doi.org/${rec.doi}`} target="_blank" rel="noreferrer" className="text-cyan">{rec.doi}</a></span>
                            )}
                            {Array.isArray(rec.meshTerms) && rec.meshTerms.length > 0 && (
                              <div className="flex-row flex-wrap gap-1">
                                {rec.meshTerms.map((term, tIdx) => (
                                  <span key={tIdx} className="mesh-badge">
                                    #{term}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: Approve vs Reject */}
              <div className="flex-end gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="btn-danger"
                  disabled={actionLoading}
                >
                  <XCircle size={16} /> Decline Recommendation
                </button>

                <button
                  type="button"
                  onClick={handleApprovePlan}
                  className="auth-submit-btn btn-auto-width"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      <CheckCircle size={16} /> Approve & Apply Plan (v{reviewData.planVersion})
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* REJECTION REASON MODAL */}
      {showRejectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="auth-card p-8" style={{ maxWidth: '500px' }}>
            <h3 className="text-rose-light m-0 mb-2" style={{ fontSize: '1.2rem' }}>Decline Plan Recommendation</h3>
            <p className="text-muted m-0 mb-4" style={{ fontSize: '0.85rem' }}>
              Please provide feedback on why you are declining these proposed targets. This will be stored for audit tracking.
            </p>

            <form onSubmit={handleRejectPlanSubmit} className="flex-col gap-5">
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Travel schedule makes 8h sleep impossible this week"
                className="auth-input retro-textarea-custom"
                required
              />

              <div className="flex-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={actionLoading}
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
