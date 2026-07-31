import React, { useState } from 'react';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    dob: '',
    sex: 'Male',
    name: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin 
      ? { username: formData.username, password: formData.password }
      : formData;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      if (isLogin) {
        onLoginSuccess(data.user);
      } else {
        setIsLogin(true);
        setError({ type: 'success', message: 'Account created successfully! Please log in.' });
        setFormData({
          username: formData.username,
          password: '',
          email: '',
          dob: '',
          sex: 'Male',
          name: ''
        });
      }
    } catch (err) {
      setError({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Restrict calendar ranges to 100 years ago up to today for year-scroll performance
  const todayStr = new Date().toISOString().split('T')[0];
  const hundredYearsAgoStr = `${new Date().getFullYear() - 100}-01-01`;

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header Title block */}
        <div className="auth-header">
          <h1 className="auth-title">Wellness Agent</h1>
          <p className="auth-subtitle">Longitudinal Health & Nutrition Review Agent</p>
        </div>

        {/* Auth Tab Toggle Slider */}
        <div className="auth-tab-toggle">
          <button
            type="button"
            onClick={() => { setError(null); setIsLogin(true); }}
            className={`auth-tab-btn ${isLogin ? 'active' : ''}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setError(null); setIsLogin(false); }}
            className={`auth-tab-btn ${!isLogin ? 'active' : ''}`}
          >
            Sign Up
          </button>
        </div>

        {/* Validation Banners */}
        {error && (
          <div className={`alert-banner ${error.type === 'success' ? 'success' : 'danger'}`}>
            <span>{error.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!isLogin && (
            <>
              {/* Full Name field */}
              <div className="auth-input-group">
                <label htmlFor="name" className="auth-label">Full Name</label>
                <div className="auth-input-wrapper">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="auth-input"
                    required
                  />
                </div>
              </div>

              {/* Email field */}
              <div className="auth-input-group">
                <label htmlFor="email" className="auth-label">Email Address</label>
                <div className="auth-input-wrapper">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="auth-input"
                    required
                  />
                </div>
              </div>

              {/* DOB & Sex Grid */}
              <div className="auth-grid-2">
                <div className="auth-input-group">
                  <label htmlFor="dob" className="auth-label">Date of Birth</label>
                  <div className="auth-input-wrapper">
                    <input
                      type="date"
                      id="dob"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      min={hundredYearsAgoStr}
                      max={todayStr}
                      className="auth-input"
                      style={{ colorScheme: 'dark' }}
                      required
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label htmlFor="sex" className="auth-label">Biological Sex</label>
                  <div className="auth-input-wrapper">
                    <select
                      id="sex"
                      name="sex"
                      value={formData.sex}
                      onChange={handleChange}
                      className="auth-select"
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Username field */}
          <div className="auth-input-group">
            <label htmlFor="username" className="auth-label">Username</label>
            <div className="auth-input-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="auth-input"
                required
              />
            </div>
          </div>

          {/* Password field */}
          <div className="auth-input-group">
            <label htmlFor="password" className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="auth-input"
                required
              />
            </div>
          </div>

          {/* Action button */}
          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={loading}
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
