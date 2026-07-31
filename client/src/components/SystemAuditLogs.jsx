import React, { useState, useEffect } from 'react';
import { ShieldCheck, Bug, Activity, AlertOctagon, HelpCircle, RefreshCw } from 'lucide-react';

export default function SystemAuditLogs({ username }) {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const fetchAudits = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/audits?username=${username.toLowerCase()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch audit logs');
      }
      setAuditLogs(data.auditLogs || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, [username]);

  const handleSimulateFailure = async (failureType) => {
    setSimulating(true);
    setSimulationResult(null);
    try {
      const response = await fetch('/api/audits/simulate-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          failureType
        })
      });

      const data = await response.json();
      
      setSimulationResult({
        status: response.status,
        statusText: response.statusText,
        message: data.message,
        success: data.success
      });

      // Refresh audits to show the newly logged failure
      fetchAudits();

    } catch (err) {
      setSimulationResult({
        status: 'Error',
        statusText: 'Fetch Error',
        message: err.message,
        success: false
      });
    } finally {
      setSimulating(false);
    }
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'UserCorrection':
        return <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>User Correction</span>;
      case 'PlanModification':
        return <span className="badge badge-success" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-accent)', borderColor: 'rgba(59, 130, 246, 0.3)', fontSize: '0.75rem' }}>Plan Override</span>;
      case 'RejectedRecommendation':
        return <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>Plan Rejected</span>;
      case 'AIUncertainty':
        return <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>AI Uncertainty</span>;
      case 'SafetyTrigger':
        return <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.2)', fontSize: '0.75rem' }}>Safety Boundary</span>;
      case 'WorkflowFailure':
        return <span className="badge badge-danger" style={{ borderStyle: 'dashed', fontSize: '0.75rem' }}>Workflow Failure</span>;
      default:
        return <span className="badge">{type}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>System Audit Logs</h1>
          <p>Inspect AI uncertainty logs, user corrections, safety boundaries, and workflow states.</p>
        </div>
        <button onClick={fetchAudits} className="btn btn-secondary" style={{ gap: '0.5rem' }} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh Logs
        </button>
      </div>

      {errorMsg && (
        <div className="alert-banner danger">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Observability Failure Simulators Grid */}
      <div className="glass-card" style={{ borderLeft: '3px solid var(--color-warning)' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--color-warning)' }}>
          <Bug size={18} />
          Observability & Failure Simulation Panels (QA Testing)
        </h3>
        <p style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Trigger simulated backend API errors to verify that client-side safety nets and error banners render robustly.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <button
            onClick={() => handleSimulateFailure('DatabaseTimeout')}
            className="btn btn-secondary"
            style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)', fontSize: '0.85rem' }}
            disabled={simulating}
          >
            Simulate DB Timeout (504)
          </button>
          <button
            onClick={() => handleSimulateFailure('NetworkLatency')}
            className="btn btn-secondary"
            style={{ borderColor: 'var(--color-alert)', color: 'var(--color-alert)', fontSize: '0.85rem' }}
            disabled={simulating}
          >
            Simulate LLM Latency (503)
          </button>
        </div>

        {simulationResult && (
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <strong style={{ color: simulationResult.status >= 500 ? 'var(--color-alert)' : 'var(--color-primary)' }}>
              Simulation HTTP Status: {simulationResult.status} {simulationResult.statusText}
            </strong>
            <p style={{ marginTop: '0.5rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
              {simulationResult.message}
            </p>
          </div>
        )}
      </div>

      {/* Audits History Log Grid */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Activity size={18} style={{ color: 'var(--color-primary)' }} />
          Database Audit Event Trail
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Timestamp</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Event Category</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Audit Description</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Event Details (JSON Payload)</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No audit records registered yet. Create meal logs or edit plan recommendations to generate audits.
                  </td>
                </tr>
              ) : (
                auditLogs.map(log => (
                  <tr key={log.logId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', verticalAlign: 'top' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {getEventBadge(log.eventType)}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>
                      {log.description}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', maxWidth: '350px' }}>
                      <details style={{ cursor: 'pointer' }}>
                        <summary style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                          View Raw Details
                        </summary>
                        <pre style={{
                          marginTop: '0.5rem',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          color: 'var(--text-secondary)'
                        }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
