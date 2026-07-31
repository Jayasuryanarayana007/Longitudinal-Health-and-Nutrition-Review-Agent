import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, ChevronDown, ChevronUp, BookOpen, Clock } from 'lucide-react';

export default function ActivePlanCard({ currentUser, refreshTrigger }) {
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedEvidence, setExpandedEvidence] = useState({});

  const fetchActivePlan = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plans/active?username=${encodeURIComponent(currentUser.username)}`);
      const data = await response.json();
      if (response.ok && data.activePlan) {
        setActivePlan(data.activePlan);
      } else {
        setActivePlan(null);
      }
    } catch (e) {
      setActivePlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivePlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username, refreshTrigger]);

  const toggleEvidence = (idx) => {
    setExpandedEvidence(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (loading || !activePlan || !activePlan.suggestions || activePlan.suggestions.length === 0) {
    return null; // Don't block UI if no approved plan exists yet
  }

  const formattedDate = new Date(activePlan.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="auth-card" style={{
      maxWidth: 'none',
      padding: '1.5rem',
      background: 'rgba(16, 185, 129, 0.05)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      borderRadius: '12px'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(16, 185, 129, 0.15)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '0.4rem', borderRadius: '8px', color: '#34d399', display: 'flex' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', margin: 0, color: '#f8fafc', fontWeight: '700' }}>
              Today's Active Approved Plan
            </h4>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Version <strong style={{ color: '#34d399' }}>v{activePlan.version}</strong> (Active) <Clock size={12} /> Activated on {formattedDate}
            </span>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.3rem 0.75rem', borderRadius: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <CheckCircle2 size={14} /> Approved Protocol
        </span>
      </div>

      {/* Active Guidelines & Evidence Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {activePlan.suggestions.map((sug, idx) => {
          const isExpanded = !!expandedEvidence[idx];
          return (
            <div key={idx} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleEvidence(idx)}
                    title="Toggle Supporting Evidence"
                    style={{
                      background: isExpanded ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem',
                      color: isExpanded ? '#34d399' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <strong style={{ color: '#10b981', fontSize: '0.85rem' }}>[{sug.category}]</strong>
                </div>

                {sug.targetValue && (
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f8fafc', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    Target: {sug.targetValue}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                {sug.proposal}
              </div>

              {/* Expandable Evidence */}
              {isExpanded && sug.evidence && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.78rem',
                  color: '#cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  marginTop: '0.25rem'
                }}>
                  <div style={{ fontWeight: '600', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <BookOpen size={12} /> Clinical Evidence (Ref: #{sug.kbArticleId || 'RAG-Ref'})
                  </div>
                  <div style={{ fontStyle: 'italic', lineHeight: '1.3' }}>
                    "{sug.evidence}"
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
