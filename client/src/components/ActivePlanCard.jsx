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
    } catch {
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
    return null;
  }

  const formattedDate = new Date(activePlan.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="auth-card full-width evidence-box m-0 p-6">
      
      {/* Header */}
      <div className="flex-between flex-wrap gap-4 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.15)' }}>
        <div className="flex-row gap-3">
          <div className="app-brand-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-white text-bold m-0" style={{ fontSize: '1.05rem' }}>
              Today's Active Approved Plan
            </h4>
            <span className="flex-row gap-2 text-muted" style={{ fontSize: '0.8rem' }}>
              Version <strong className="text-emerald-light">v{activePlan.version}</strong> (Active) <Clock size={12} /> Activated on {formattedDate}
            </span>
          </div>
        </div>

        <span className="badge badge-primary">
          <CheckCircle2 size={14} /> Approved Protocol
        </span>
      </div>

      {/* Active Guidelines & Evidence Grid */}
      <div className="grid-2-col gap-3">
        {activePlan.suggestions.map((sug, idx) => {
          const isExpanded = !!expandedEvidence[idx];
          return (
            <div key={sug.category || idx} className="item-row-card flex-col gap-2 p-4">
              <div className="flex-between gap-2">
                <div className="flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => toggleEvidence(idx)}
                    title="Toggle Supporting Evidence"
                    className="app-nav-tab p-1"
                    style={{ background: isExpanded ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)', color: isExpanded ? '#34d399' : '#94a3b8' }}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <strong className="text-emerald" style={{ fontSize: '0.85rem' }}>[{sug.category}]</strong>
                </div>

                {sug.targetValue && (
                  <span className="badge" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f8fafc', background: 'rgba(255,255,255,0.08)' }}>
                    Target: {sug.targetValue}
                  </span>
                )}
              </div>

              <div className="text-main" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                {sug.proposal}
              </div>

              {/* Expandable Evidence */}
              {isExpanded && sug.evidence && (
                <div className="evidence-box">
                  <div className="evidence-title">
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
