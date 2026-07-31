import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import DataLogger from './components/DataLogger';
import AIReviewPanel from './components/AIReviewPanel';
import { LogOut, Activity, LayoutDashboard, PenTool, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'logger'

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
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f1f5f9' }}>
      
      {/* Premium Top Navigation Bar */}
      <header style={{
        background: '#151d30',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Logo Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(5, 150, 105, 0.1)',
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(5, 150, 105, 0.2)',
              color: '#10b981',
              display: 'flex'
            }}>
              <Activity size={20} />
            </div>
            <strong style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Wellness Review</strong>
          </div>

          {/* User metadata & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Logged in as <strong style={{ color: '#f8fafc' }}>{currentUser.name || currentUser.username}</strong>
              <span style={{ margin: '0 0.5rem', color: 'rgba(255,255,255,0.1)' }}>|</span>
              {currentUser.sex} ({(() => {
                const today = new Date();
                const birth = new Date(currentUser.dob);
                let age = today.getFullYear() - birth.getFullYear();
                const monthDiff = today.getMonth() - birth.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
                return age;
              })()} yrs)
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                color: '#f1f5f9',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        
        {/* Navigation Tabs Bar */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              background: activeTab === 'dashboard' ? '#1e293b' : 'transparent',
              border: activeTab === 'dashboard' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              color: activeTab === 'dashboard' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          
          <button
            onClick={() => setActiveTab('logger')}
            style={{
              background: activeTab === 'logger' ? '#1e293b' : 'transparent',
              border: activeTab === 'logger' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              color: activeTab === 'logger' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease'
            }}
          >
            <PenTool size={16} /> Log Daily Metrics
          </button>

          <button
            onClick={() => setActiveTab('review')}
            style={{
              background: activeTab === 'review' ? '#1e293b' : 'transparent',
              border: activeTab === 'review' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              color: activeTab === 'review' ? '#ffffff' : '#94a3b8',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={16} style={{ color: '#10b981' }} /> AI Retrospective & Plans
          </button>
        </div>

        {/* Dynamic Component Content Panel */}
        <main>
          {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} />}
          {activeTab === 'logger' && <DataLogger currentUser={currentUser} />}
          {activeTab === 'review' && <AIReviewPanel currentUser={currentUser} />}
        </main>

      </div>
    </div>
  );
}
