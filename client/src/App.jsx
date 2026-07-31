import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  // Check session storage on mount
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
    <div style={{
      maxWidth: '600px',
      margin: '4rem auto',
      padding: '2.5rem',
      background: 'rgba(30, 41, 59, 0.7)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      fontFamily: 'sans-serif',
      color: '#f8fafc',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
    }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: '#10b981' }}>
        ✓ Layer 1 (V1) Completed Successfully
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
        Database tables initialized, credential hashes generated, and multi-user authentication gateway verified.
      </p>

      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        padding: '1.25rem',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.04)',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Authenticated Session Data</h3>
        <p style={{ margin: '0.5rem 0' }}><strong>Username:</strong> @{currentUser.username}</p>
        <p style={{ margin: '0.5rem 0' }}><strong>Date of Birth:</strong> {currentUser.dob}</p>
        <p style={{ margin: '0.5rem 0' }}><strong>Biological Sex:</strong> {currentUser.sex}</p>
        <p style={{ margin: '0.5rem 0' }}><strong>Active Goal Version:</strong> v{currentUser.activeGoal ? currentUser.activeGoal.version : 1}</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Sign Out
        </button>
        <button
          disabled
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: 'rgba(16, 185, 129, 0.6)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            cursor: 'not-allowed',
            fontWeight: '600'
          }}
        >
          Stage V2: Logging (Locked)
        </button>
      </div>
    </div>
  );
}
