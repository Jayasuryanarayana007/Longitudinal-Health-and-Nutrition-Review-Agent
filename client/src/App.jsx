import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import DataLogger from './components/DataLogger';
import AIReviewPanel from './components/AIReviewPanel';
import AuditDashboard from './components/AuditDashboard';
import { LogOut, Activity, LayoutDashboard, PenTool, Sparkles, ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Retrieve user session on mount
  useEffect(() => {
    const session = sessionStorage.getItem('wellness_session');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    sessionStorage.setItem('wellness_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('wellness_session');
  };

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="app-header-container">
          
          {/* Logo Brand */}
          <div className="app-brand">
            <div className="app-brand-icon">
              <Activity size={20} />
            </div>
            <strong className="app-brand-title">Wellness Review</strong>
          </div>

          {/* User metadata & Logout */}
          <div className="app-user-area">
            <div className="app-user-meta">
              Logged in as <strong className="app-user-name">{currentUser.name || currentUser.username}</strong>
              <span className="app-divider">|</span>
              {currentUser.sex} ({(() => {
                const today = new Date();
                const birth = new Date(currentUser.dob);
                let age = today.getFullYear() - birth.getFullYear();
                const monthDiff = today.getMonth() - birth.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
                return age;
              })()} yrs)
            </div>

            <button onClick={handleLogout} className="app-btn-signout">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="app-main-container">
        
        {/* Navigation Tabs Bar */}
        <div className="app-nav-tabs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`app-nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          
          <button
            onClick={() => setActiveTab('logger')}
            className={`app-nav-tab ${activeTab === 'logger' ? 'active' : ''}`}
          >
            <PenTool size={16} /> Log Daily Metrics
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`app-nav-tab ${activeTab === 'review' ? 'active' : ''}`}
          >
            <Sparkles size={16} style={{ color: '#10b981' }} /> AI Retrospective & Plans
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`app-nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
          >
            <ShieldCheck size={16} style={{ color: '#fbbf24' }} /> Audit & Safety Panel
          </button>
        </div>

        {/* Dynamic Component Content Panel */}
        <main>
          {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} />}
          {activeTab === 'logger' && <DataLogger currentUser={currentUser} />}
          {activeTab === 'review' && <AIReviewPanel currentUser={currentUser} />}
          {activeTab === 'audit' && <AuditDashboard currentUser={currentUser} />}
        </main>

      </div>
    </div>
  );
}
