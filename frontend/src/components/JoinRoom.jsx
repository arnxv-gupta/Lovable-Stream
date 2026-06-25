import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { emoji: '🍿', label: 'Synced Movies' },
  { emoji: '📹', label: 'Video Calls' },
  { emoji: '💬', label: 'Live Chat' },
  { emoji: '❤️', label: 'Reactions' },
  { emoji: '👑', label: 'Host Controls' },
];

const LovableIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 38s-14-9.3-14-18.5C8 13.1 13.6 8 20 9.6c1.2.3 2.3.9 3.2 1.7.9-.8 2-1.4 3.2-1.7C32.4 8 38 13.1 38 19.5 38 28.7 22 38 22 38z"
      fill="white" fillOpacity="0.9"
    />
    <path
      d="M22 12c-2-2-5-2-7 0s-2 5 0 7l7 7 7-7c2-2 2-5 0-7s-5-2-7 0z"
      fill="url(#hg)" fillOpacity="0.4"
    />
    <defs>
      <linearGradient id="hg" x1="15" y1="12" x2="29" y2="26" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f43f5e"/>
        <stop offset="1" stopColor="#8b5cf6"/>
      </linearGradient>
    </defs>
  </svg>
);

const JoinRoom = () => {
  const [step, setStep] = useState('start'); // 'start' | 'join' | 'create'
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  const generateRoomId = () => {
    const words = ['cosmic', 'neon', 'solar', 'pixel', 'lunar', 'nova', 'hyper', 'prime'];
    const nums = Math.floor(Math.random() * 9000 + 1000);
    const word = words[Math.floor(Math.random() * words.length)];
    return `${word}-${nums}`;
  };

  const handleCreateRoom = () => {
    const id = generateRoomId();
    setRoomId(id);
    setStep('create');
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId.trim() && userName.trim()) {
      navigate(`/room/${roomId.trim()}`, { state: { userName: userName.trim() } });
    }
  };

  return (
    <div className="join-screen">
      <div className="join-content">
        {/* Logo */}
        <div className="join-logo fade-up">
          <div className="join-logo-icon">
            <LovableIcon />
          </div>
          <h1 className="brand-font">Lovable</h1>
          <p>Movie night from anywhere. 🍿❤️</p>
        </div>

        {/* Card */}
        <div className="join-card fade-up" style={{ animationDelay: '0.1s' }}>
          {step === 'start' && (
            <>
              <h2>Get Started</h2>
              <p className="sub">Create a new room or join an existing one.</p>
              <div className="join-form">
                <div className="input-group">
                  <label className="input-label">Your Name</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Alice"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    required
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '13px', fontSize: '0.95rem' }}
                  onClick={handleCreateRoom}
                  disabled={!userName.trim()}
                >
                  <span>👑</span> Create a Room
                </button>
                <div className="divider"><span>or</span></div>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '13px' }}
                  onClick={() => setStep('join')}
                  disabled={!userName.trim()}
                >
                  🎟️ Join Existing Room
                </button>
              </div>
            </>
          )}

          {step === 'create' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.2rem' }}>👑</span>
                <h2>Your Room is Ready!</h2>
              </div>
              <p className="sub">Share the Room ID with friends so they can join.</p>
              <form className="join-form" onSubmit={handleJoin}>
                <div className="input-group">
                  <label className="input-label">Room ID (share this!)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="input" readOnly value={roomId} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
                    <button type="button" className="btn btn-secondary" style={{ flexShrink: 0 }}
                      onClick={() => { navigator.clipboard.writeText(roomId); }}>Copy</button>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Your Name</label>
                  <input className="input" value={userName} readOnly style={{ opacity: 0.7 }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '0.95rem', marginTop: '4px' }}>
                  🚀 Start Watch Party
                </button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%' }}
                  onClick={() => setStep('start')}>← Back</button>
              </form>
            </>
          )}

          {step === 'join' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🎟️</span>
                <h2>Join a Room</h2>
              </div>
              <p className="sub">Enter the Room ID shared by the host.</p>
              <form className="join-form" onSubmit={handleJoin}>
                <div className="input-group">
                  <label className="input-label">Room ID</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. cosmic-4321"
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
                    style={{ fontFamily: 'monospace' }}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Your Name</label>
                  <input className="input" value={userName} readOnly style={{ opacity: 0.7 }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '0.95rem', marginTop: '4px' }}
                  disabled={!roomId.trim()}>
                  🎬 Join Party
                </button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%' }}
                  onClick={() => setStep('start')}>← Back</button>
              </form>
            </>
          )}
        </div>

        {/* Feature Pills */}
        <div className="feature-pills fade-up" style={{ animationDelay: '0.2s' }}>
          {FEATURES.map(f => (
            <div className="pill" key={f.label}>
              <span>{f.emoji}</span>{f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
