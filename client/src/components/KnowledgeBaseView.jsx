import React, { useState } from 'react';
import { BookOpen, FileText, CheckCircle } from 'lucide-react';

export default function KnowledgeBaseView() {
  const [activeArticle, setActiveArticle] = useState('kb-sleep-hygiene');

  const articles = [
    {
      "id": "kb-sleep-hygiene",
      "title": "Circadian Rhythm Alignment and Wind-down Protocols",
      "category": "Sleep",
      "tags": ["sleep", "recovery", "energy", "insomnia"],
      "evidence": "Consistent wake times and keeping wind-down routines free of screen blue-light supports melatonin synthesis.",
      "guidelines": [
        "Keep screen time to a minimum 60 minutes before bedtime.",
        "Reduce caffeine intake after 2:00 PM to protect sleep architecture.",
        "Target a minimum of 7 to 9 hours of sleep daily for recovery."
      ]
    },
    {
      "id": "kb-energy-balance",
      "title": "Optimal Fueling for Zone 2 Cardio and High Activity",
      "category": "Nutrition",
      "tags": ["nutrition", "activity", "fatigue", "deficit"],
      "evidence": "Adequate glycogen replenishment preserves lean muscle tissue and prevents chronic physical fatigue.",
      "guidelines": [
        "Target 2.0g of carbohydrate per kg body weight on active days.",
        "Maintain a consistent eating schedule within 3-4 hours post-workout.",
        "Fuel adequately before long workouts (at least 300-500 kcal)."
      ]
    },
    {
      "id": "kb-daily-movement",
      "title": "WHO Physical Activity and Sedentary Behavior Guidelines",
      "category": "Activity",
      "tags": ["activity", "exercise", "sedentary"],
      "evidence": "Engaging in regular physical activity decreases cardiovascular risk and elevates cognitive mood indicators.",
      "guidelines": [
        "Aim for 150-300 minutes of moderate-intensity aerobic physical activity per week.",
        "Incorporate strength training targeting major muscle groups at least 2 days a week.",
        "Break up long sedentary periods with 5-minute walking intervals."
      ]
    },
    {
      "id": "kb-stress-management",
      "title": "Cortisol Regulation and Circadian Rhythm Alignment",
      "category": "Mood",
      "tags": ["mood", "stress", "energy", "fatigue"],
      "evidence": "Mindfulness practices and proper sleep timings lower resting cortisol levels, stabilizing mood and daily focus.",
      "guidelines": [
        "Incorporate 10 minutes of deep-breathing or meditation on high-stress days.",
        "Align sleep-wake timings within a 1-hour window daily.",
        "Log energy fluctuations to identify daily focus windows."
      ]
    }
  ];

  const selected = articles.find(a => a.id === activeArticle) || articles[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Wellness Knowledge Base</h1>
        <p>Browse curated clinical health guidelines backing your AI wellness reviews.</p>
      </div>

      <div className="grid-cols-3" style={{ gap: '2rem' }}>
        
        {/* LEFT COLUMN: Sidebar Selection List (1/3 width) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {articles.map((art) => (
            <div
              key={art.id}
              onClick={() => setActiveArticle(art.id)}
              className="glass-card"
              style={{
                cursor: 'pointer',
                padding: '1.25rem',
                borderLeft: activeArticle === art.id ? '3px solid var(--color-primary)' : '1px solid var(--border-color)',
                background: activeArticle === art.id ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-surface)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BookOpen size={18} style={{ color: activeArticle === art.id ? 'var(--color-primary)' : 'var(--text-secondary)' }} />
                <div>
                  <h4 style={{ fontSize: '0.95rem', margin: 0 }}>{art.title}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category: {art.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN: Article Viewer (2/3 width) */}
        <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <span className="badge badge-success" style={{ marginBottom: '0.5rem' }}>{selected.category} Vetted</span>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{selected.title}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {selected.tags.map((tag) => (
                <span key={tag} className="badge" style={{ fontSize: '0.7rem' }}>#{tag}</span>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Clinical Evidence Fact</h3>
            <p style={{ fontSize: '0.925rem', lineHeight: '1.6', color: 'var(--text-primary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderLeft: '3px solid var(--color-secondary)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
              "{selected.evidence}"
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Vetted Wellness Guidelines</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selected.guidelines.map((guide, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <CheckCircle size={18} style={{ color: 'var(--color-primary)', marginTop: '0.1rem', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{guide}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
