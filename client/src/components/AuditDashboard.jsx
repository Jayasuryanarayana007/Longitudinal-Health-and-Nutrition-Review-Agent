import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Zap, Search, Clock, FileJson, AlertCircle } from 'lucide-react';

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
      case 'MedicalSafetyBypass': return 'badge-danger';
      case 'WorkflowFailure': return 'badge-amber';
      case 'RejectedRecommendation': return 'badge-danger';
      case 'UserCorrection': return 'badge-cyan';
      case 'PlanModification': return 'badge-purple';
      case 'AIUncertainty': return 'badge-amber';
      default: return 'badge-primary';
    }
  };

  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(l.logId || '').toLowerCase().includes(q) ||
      String(l.username || '').toLowerCase().includes(q) ||
      String(l.description || '').toLowerCase().includes(q) ||
      String(l.eventType || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="panel-container" style={{ maxWidth: '1000px' }}>
      
      {/* Page Header */}
      <div>
        <h2 className="panel-header-title">
          Auditing Dashboard & Safety Control Panel
        </h2>
        <p className="panel-header-sub">
          Full observability over user meal overrides, AI uncertainties, plan rejections, safety refusal intercepts, and API failure simulations.
        </p>
      </div>

      {/* TOP CARD: API Failure & Resilience Simulators */}
      <div className="auth-card max-w-none p-6" style={{ background: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
        <div className="flex-between flex-wrap gap-4 pb-3 mb-4 border-subtle" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-row gap-3">
            <div className="app-brand-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Zap size={20} />
            </div>
            <div>
              <h4 className="text-white text-bold m-0" style={{ fontSize: '1.1rem' }}>
                System Resilience & Manual Failure Simulators
              </h4>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                Test system resilience under simulated 504 Timeout and 503 Unavailable network conditions.
              </span>
            </div>
          </div>
        </div>

        <div className="flex-row flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={() => handleSimulateFailure('timeout504')}
            className="badge badge-amber p-2"
            disabled={simulating}
          >
            <Clock size={16} /> Simulate 504 Gateway Timeout
          </button>

          <button
            type="button"
            onClick={() => handleSimulateFailure('unavailable503')}
            className="btn-danger p-2"
            disabled={simulating}
          >
            <AlertTriangle size={16} /> Simulate 503 Service Unavailable
          </button>

          {simulating && <div className="spinner"></div>}
        </div>

        {/* Simulation Output Banner */}
        {simResult && (
          <div className={`alert-banner ${simResult.status >= 500 ? 'warning' : 'info'} mt-4`}>
            <AlertCircle size={18} />
            <div>
              <strong>HTTP {simResult.status} Simulation Response:</strong> {simResult.message}
            </div>
          </div>
        )}
      </div>

      {/* AUDIT LOGS EXPLORER */}
      <div className="auth-card max-w-none card-padded">
        
        {/* Filter Controls Bar */}
        <div className="card-header-flex">
          <div className="flex-row gap-3 flex-wrap items-center">
            {/* User Audit Log Indicator Badge */}
            <span className="badge badge-cyan">
              👤 My Audit Log Trail
            </span>

            <label htmlFor="audit-filter-select" className="auth-label m-0 text-muted" style={{ fontSize: '0.85rem' }}>Filter Event:</label>
            <select
              id="audit-filter-select"
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
              className="app-nav-tab p-2"
              title="Refresh Audit Logs"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Search Box */}
          <div className="flex-row gap-2 auth-input" style={{ width: 'auto', padding: '0.4rem 0.75rem' }}>
            <Search size={16} className="text-subtle" />
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
          <div className="alert-banner danger mb-6">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Audit Table */}
        {loading ? (
          <div className="loading-box text-muted">
            <div className="spinner spinner-lg"></div>
            Loading Audit Log Records...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="loading-box text-subtle">
            No audit records match the selected filters.
          </div>
        ) : (
          <div className="flex-col gap-3">
            {filteredLogs.map((log) => {
              const badgeClass = getEventBadgeClass(log.eventType);
              const isExpanded = expandedLogId === log.logId;
              const formattedTime = new Date(log.timestamp).toLocaleString();

              return (
                <div key={log.logId} className="item-row-card flex-col gap-2 p-4">
                  <div className="flex-between flex-wrap gap-3">
                    <div className="flex-row gap-3" style={{ flex: 1, minWidth: '260px' }}>
                      
                      {/* Event Badge */}
                      <span className={`badge ${badgeClass}`}>
                        {log.eventType}
                      </span>

                      <div className="text-white text-semibold" style={{ fontSize: '0.88rem' }}>
                        {log.description}
                      </div>
                    </div>

                    <div className="flex-row gap-4">
                      <span className="text-subtle" style={{ fontSize: '0.78rem' }}>
                        User: <strong className="text-muted">{log.username}</strong> | {formattedTime}
                      </span>

                      {/* Expand Details Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.logId)}
                        className="app-nav-tab p-2"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <FileJson size={14} /> {isExpanded ? 'Hide Payload' : 'View Payload'}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable JSON Payload Viewer */}
                  {isExpanded && (
                    <div className="audit-json-box">
                      <pre className="m-0">
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
