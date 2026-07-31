import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PenTool, Brain, Goal, BookOpen, ScrollText, LogOut, Settings } from 'lucide-react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import DataLogger from './components/DataLogger';
import AIReviewAgent from './components/AIReviewAgent';
import GoalManager from './components/GoalManager';
import KnowledgeBaseView from './components/KnowledgeBaseView';
import SystemAuditLogs from './components/SystemAuditLogs';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [logs, setLogs] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [activeGoal, setActiveGoal] = useState({ version: 1, targetSleepHours: 8.0, targetDailyCalories: 2000.0, targetActivityMinutes: 30 });
  const [activePlan, setActivePlan] = useState(null);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  // Check sessionStorage on load
  useEffect(() => {
    const session = sessionStorage.getItem('wellness_session');
    if (session) {
      const parsed = JSON.parse(session);
      handleLoginSuccess(parsed);
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveGoal(user.activeGoal);
    sessionStorage.setItem('wellness_session', JSON.stringify(user));
    
    // Fetch logs and stats for the logged-in user
    fetchUserData(user.username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLogs([]);
    setWeeklyStats(null);
    setMonthlyStats(null);
    setActivePlan(null);
    sessionStorage.removeItem('wellness_session');
    setActiveTab('Dashboard');
  };

  const fetchUserData = async (username) => {
    const userLower = username.toLowerCase();
    try {
      // 1. Fetch Logs History
      const logsRes = await fetch(`/api/logs/history?username=${userLower}`);
      const logsData = await logsRes.json();
      if (logsRes.ok) {
        setLogs(logsData.logs || []);
      }

      // 2. Fetch Weekly/Monthly summaries
      const statsRes = await fetch(`/api/logs/summaries?username=${userLower}`);
      const statsData = await statsRes.json();
      if (statsRes.ok) {
        setWeeklyStats(statsData.weekly);
        setMonthlyStats(statsData.monthly);
        setActiveGoal(statsData.goals);
      }

      // 3. Fetch Active Plan details
      const planRes = await fetch(`/api/plans/active?username=${userLower}`);
      const planData = await planRes.json();
      if (planRes.ok) {
        setActivePlan(planData.activePlan || null);
      }

      // Check if backend has a Gemini API key loaded
      // We check this by sending a quick check or default state check.
      // We can query the meal extractor mode directly or rely on the return payload of RAG/Meal endpoints which returns hasApiKey.
      // For simplicity, we check a mock route or default to local detection based on backend API.
      setHasGeminiKey(false); // Default local fallback, dynamically updated by review requests

    } catch (err) {
      console.error('Failed to retrieve user metrics data:', err);
    }
  };

  const handleLogSubmitted = () => {
    if (currentUser) {
      fetchUserData(currentUser.username);
    }
  };

  const handleGoalsUpdated = (newGoal) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, activeGoal: newGoal };
      setCurrentUser(updatedUser);
      sessionStorage.setItem('wellness_session', JSON.stringify(updatedUser));
      setActiveGoal(newGoal);
      fetchUserData(currentUser.username);
    }
  };

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <Dashboard
            weeklyStats={weeklyStats}
            monthlyStats={monthlyStats}
            activeGoal={activeGoal}
            logs={logs}
          />
        );
      case 'Logger':
        return (
          <DataLogger
            username={currentUser.username}
            onLogSubmitted={handleLogSubmitted}
          />
        );
      case 'AI Reviews':
        return (
          <AIReviewAgent
            username={currentUser.username}
            onPlanUpdated={() => fetchUserData(currentUser.username)}
          />
        );
      case 'Goals & Plans':
        return (
          <GoalManager
            username={currentUser.username}
            activeGoal={activeGoal}
            onGoalsUpdated={handleGoalsUpdated}
          />
        );
      case 'Knowledge Base':
        return <KnowledgeBaseView />;
      case 'System Audit':
        return <SystemAuditLogs username={currentUser.username} />;
      default:
        return <Dashboard activeGoal={activeGoal} logs={logs} />;
    }
  };

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="sidebar">
        <div className="nav-logo">
          <div style={{ background: 'var(--color-primary-glow)', padding: '0.5rem', borderRadius: '50%', color: 'var(--color-primary)', display: 'inline-flex' }}>
            <Brain size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: '800', background: 'linear-gradient(135deg, #ffffff 30%, #a3e635 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              WELLNESS AGENT
            </h2>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>Active Lifestyle review</span>
          </div>
        </div>

        <nav>
          <ul className="nav-menu">
            <li className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('Dashboard')}>
              <LayoutDashboard size={18} /> Dashboard
            </li>
            <li className={`nav-item ${activeTab === 'Logger' ? 'active' : ''}`} onClick={() => setActiveTab('Logger')}>
              <PenTool size={18} /> Log Data
            </li>
            <li className={`nav-item ${activeTab === 'AI Reviews' ? 'active' : ''}`} onClick={() => setActiveTab('AI Reviews')}>
              <Brain size={18} /> AI Reviews
            </li>
            <li className={`nav-item ${activeTab === 'Goals & Plans' ? 'active' : ''}`} onClick={() => setActiveTab('Goals & Plans')}>
              <Goal size={18} /> Goals & Plans
            </li>
            <li className={`nav-item ${activeTab === 'Knowledge Base' ? 'active' : ''}`} onClick={() => setActiveTab('Knowledge Base')}>
              <BookOpen size={18} /> Knowledge Base
            </li>
            <li className={`nav-item ${activeTab === 'System Audit' ? 'active' : ''}`} onClick={() => setActiveTab('System Audit')}>
              <ScrollText size={18} /> System Audit
            </li>
          </ul>
        </nav>

        {/* LOGGED IN SESSION FOOTER */}
        <div className="nav-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session Account:</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>@{currentUser.username}</strong>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', gap: '0.25rem' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* PRIMARY VIEWER CONTAINER */}
      <main className="main-content">
        {/* TOP META-HEADER ROW */}
        <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          {activePlan && (
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              Active Plan: Version V{activePlan.version}
            </span>
          )}
          <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
            AI Mode: Server Proxy
          </span>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}
