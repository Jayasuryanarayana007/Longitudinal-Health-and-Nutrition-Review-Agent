import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Zap, Search, Clock, FileJson, AlertCircle } from 'lucide-react';

export default function AuditDashboard({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventTypeFilter, setEventTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Simulator state
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/audit/logs?username=${encodeURIComponent(currentUser.username)}&eventType=${encodeURIComponent(eventTypeFilter)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch audit logs.');
      setLogs(data.auditLogs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypeFilter, currentUser.username]);

  const handleSimulateFailure = async (failureType) => {
    setSimulating(true);
    setSimResult(null);
    try {
      const response = await fetch('/api/audit/simulate-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, failureType })
      });
      const data = await response.json();
      setSimResult({
        status: response.status,
        message: data.message || 'Simulation response received.'
      });
      // Refresh audit logs list to display newly logged WorkflowFailure event
      fetchAuditLogs();
    } catch (err) {
      setSimResult({ status: 500, message: err.message });
    } finally {
      setSimulating(false);
    }
  };

  const toggleExpand = (logId) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const getEventBadgeClass = (type) => {
    switch (type) {
      case 'MedicalSafetyBypass': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'WorkflowFailure': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'RejectedRecommendation': return { bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: 'rgba(236, 72, 153, 0.3)' };
      case 'UserCorrection': return { bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: 'rgba(6, 182, 212, 0.3)' };
      case 'PlanModification': return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
      case 'AIUncertainty': return { bg: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', border: 'rgba(251, 146, 60, 0.3)' };
      default: return { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.logId.toLowerCase().includes(q) ||
      l.username.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.eventType.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
          Auditing Dashboard & Safety Control Panel
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>
          Full observability over user meal overrides, AI uncertainties, plan rejections, safety refusal intercepts, and API failure simulations.
        </p>
      </div>

      {/* TOP CARD: API Failure & Resilience Simulators */}
      <div className="auth-card" style={{ maxWidth: 'none', padding: '1.5rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.4rem', borderRadius: '8px', color: '#fbbf24', display: 'flex' }}>
              <Zap size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', margin: 0, color: '#f8fafc', fontWeight: '700' }}>
                System Resilience & Manual Failure Simulators
              </h4>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Test system resilience under simulated 504 Timeout and 503 Unavailable network conditions.
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => handleSimulateFailure('timeout504')}
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '0.65rem 1.25rem',
              color: '#fbbf24',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            disabled={simulating}
          >
            <Clock size={16} /> Simulate 504 Gateway Timeout
          </button>

          <button
            type="button"
            onClick={() => handleSimulateFailure('unavailable503')}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '0.65rem 1.25rem',
              color: '#f87171',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            disabled={simulating}
          >
            <AlertTriangle size={16} /> Simulate 503 Service Unavailable
          </button>

          {simulating && <div className="spinner"></div>}
        </div>

        {/* Simulation Output Banner */}
        {simResult && (
          <div className={`alert-banner ${simResult.status >= 500 ? 'warning' : 'info'}`} style={{ marginTop: '1rem' }}>
            <AlertCircle size={18} />
            <div>
              <strong>HTTP {simResult.status} Simulation Response:</strong> {simResult.message}
            </div>
          </div>
        )}
      </div>

      {/* AUDIT LOGS EXPLORER */}
      <div className="auth-card" style={{ maxWidth: 'none', padding: '2rem' }}>
        
        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* User Audit Log Indicator Badge */}
            <span style={{
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '20px',
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              👤 My Audit Log Trail
            </span>

            <label className="auth-label" style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Filter Event:</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="auth-select"
              style={{ width: '210px', padding: '0.5rem 0.75rem' }}
            >
              <option value="All">All Event Types</option>
              <option value="MedicalSafetyBypass">⚠️ MedicalSafetyBypass</option>
              <option value="UserCorrection">✍️ UserCorrection</option>
              <option value="PlanModification">📝 PlanModification</option>
              <option value="RejectedRecommendation">🛑 RejectedRecommendation</option>
              <option value="AIUncertainty">❓ AIUncertainty</option>
              <option value="WorkflowFailure">⚡ WorkflowFailure</option>
            </select>

            <button
              type="button"
              onClick={fetchAuditLogs}
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px', padding: '0.55rem', color: '#94a3b8', cursor: 'pointer' }}
              title="Refresh Audit Logs"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.4rem 0.75rem' }}>
            <Search size={16} style={{ color: '#64748b' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, username..."
              style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.85rem', outline: 'none', width: '200px' }}
            />
          </div>
        </div>

        {error && (
          <div className="alert-banner danger" style={{ marginBottom: '1.5rem' }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Audit Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }}></div>
            Loading Audit Log Records...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#64748b' }}>
            No audit records match the selected filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredLogs.map((log) => {
              const badge = getEventBadgeClass(log.eventType);
              const isExpanded = expandedLogId === log.logId;
              const formattedTime = new Date(log.timestamp).toLocaleString();

              return (
                <div key={log.logId} style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: `1px solid ${badge.border}`,
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: '260px' }}>
                      
                      {/* Event Badge */}
                      <span style={{
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        borderRadius: '6px',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        {log.eventType}
                      </span>

                      <div style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: '500' }}>
                        {log.description}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        User: <strong style={{ color: '#94a3b8' }}>{log.username}</strong> | {formattedTime}
                      </span>

                      {/* Expand Details Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.logId)}
                        style={{
                          background: isExpanded ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.35rem 0.6rem',
                          color: '#e2e8f0',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <FileJson size={14} /> {isExpanded ? 'Hide Payload' : 'View Payload'}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable JSON Payload Viewer */}
                  {isExpanded && (
                    <div style={{
                      background: '#090d16',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      padding: '0.85rem',
                      marginTop: '0.5rem',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: '#34d399',
                      overflowX: 'auto'
                    }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
