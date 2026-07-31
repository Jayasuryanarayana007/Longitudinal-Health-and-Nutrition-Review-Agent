import React, { useState } from 'react';
import { Sparkles, CheckCircle, ShieldAlert, ChevronDown, ChevronUp, BookOpen, Edit3, XCircle, FileText } from 'lucide-react';
import GoalProfileCard from './GoalProfileCard';

export default function AIReviewPanel({ currentUser, onGoalsUpdated }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [editedRetroText, setEditedRetroText] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [userModified, setUserModified] = useState(false);

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
        body: JSON.stringify({ username: currentUser.username, date })
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
          userModified
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
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
          AI Wellness Agent & Plan Versioning
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>
          Manage target goals, generate evidence-backed retrospectives, and approve versioned plans.
        </p>
      </div>

      {/* TOP CARD: Active Goals Profile Component */}
      <GoalProfileCard currentUser={currentUser} onGoalsUpdated={onGoalsUpdated} />

      {/* Main Review Section */}
      <div className="auth-card" style={{ maxWidth: 'none', padding: '2rem' }}>
        
        {/* Trigger Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
              Weekly Review & Retrospective Generator
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Queries RAG Knowledge Base and separates Facts from Interpretations.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="auth-input"
              style={{ width: '150px', padding: '0.5rem 0.75rem', colorScheme: 'dark' }}
            />

            <button
              type="button"
              onClick={handleGenerateReview}
              className="auth-submit-btn"
              style={{ width: 'auto', padding: '0.65rem 1.4rem', marginTop: 0 }}
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
          <div className="alert-banner success" style={{ marginBottom: '1.5rem' }}>
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="alert-banner danger" style={{ marginBottom: '1.5rem' }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* REVIEW RESULTS DISPLAY */}
        {reviewData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
            
            {/* SECTION 1: Facts vs. Interpretations Separator */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* FACTS PANEL */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <h4 style={{ fontSize: '1rem', color: '#06b6d4', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} /> Factual Statistics (Logged Data)
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#e2e8f0', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {reviewData.facts.map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>

              {/* INTERPRETATIONS PANEL */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                <h4 style={{ fontSize: '1rem', color: '#a855f7', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} /> Contextual AI Hypotheses (Interpretations)
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#e2e8f0', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {reviewData.interpretations.map((interp, idx) => (
                    <li key={idx}>{interp}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SECTION 2: Editable Retrospective Text Block */}
            <div style={{ background: 'rgba(15, 23, 42, 0.3)', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label className="auth-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#f8fafc' }}>Editable Retrospective Text Narrative</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>You can customize this narrative before archiving</span>
              </label>
              <textarea
                rows={3}
                value={editedRetroText}
                onChange={(e) => setEditedRetroText(e.target.value)}
                className="auth-input"
                style={{ padding: '0.75rem', height: 'auto', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            {/* SECTION 3: Interactive Plan Approval Panel (v1 -> v2) */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem 0', color: '#f8fafc' }}>
                    Proposed Plan Recommendations (Version v{reviewData.planVersion})
                  </h4>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Every proposal includes evidence from the Knowledge Base. Click the dropdown icon beside any suggestion to view supporting evidence.
                  </span>
                </div>
                {userModified && (
                  <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600', background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    ✍️ Targets Modified
                  </span>
                )}
              </div>

              {/* Suggestions List with Expandable Evidence Dropdown Chevrons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {userSuggestions.map((rec, index) => {
                  const isExpanded = !!expandedEvidence[index];
                  return (
                    <div key={index} style={{
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
                          
                          {/* Dropdown Chevron Icon Button */}
                          <button
                            type="button"
                            onClick={() => toggleEvidence(index)}
                            title="Toggle Evidence & Knowledge Base Details"
                            style={{
                              background: isExpanded ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.35rem',
                              color: isExpanded ? '#34d399' : '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          <div>
                            <strong style={{ color: '#10b981', fontSize: '0.9rem' }}>[{rec.category}]</strong>{' '}
                            <span style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: '500' }}>{rec.proposal}</span>
                          </div>
                        </div>

                        {/* Editable Target Value Input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Target:</label>
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
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '6px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.8rem',
                          color: '#e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                          marginTop: '0.25rem'
                        }}>
                          <div style={{ fontWeight: '600', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <BookOpen size={14} /> Knowledge Base Evidence (Ref: #{rec.kbArticleId || 'RAG-Ref'})
                          </div>
                          <div style={{ fontStyle: 'italic', lineHeight: '1.4', color: '#cbd5e1' }}>
                            "{rec.evidence}"
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: Approve vs Reject */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    borderRadius: '8px',
                    padding: '0.75rem 1.4rem',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  disabled={actionLoading}
                >
                  <XCircle size={16} /> Decline Recommendation
                </button>

                <button
                  type="button"
                  onClick={handleApprovePlan}
                  className="auth-submit-btn"
                  style={{ width: 'auto', marginTop: 0, padding: '0.75rem 1.6rem', fontSize: '0.85rem' }}
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
          <div className="auth-card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0', color: '#f87171' }}>Decline Plan Recommendation</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
              Please provide feedback on why you are declining these proposed targets. This will be stored for audit tracking.
            </p>

            <form onSubmit={handleRejectPlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Travel schedule makes 8h sleep impossible this week"
                className="auth-input"
                style={{ padding: '0.75rem', height: 'auto', fontFamily: 'inherit' }}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', borderRadius: '6px', padding: '0.6rem 1rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#ef4444', border: 'none', color: '#ffffff', fontWeight: '600', borderRadius: '6px', padding: '0.6rem 1.2rem', cursor: 'pointer' }}
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
