import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import ReactPlayer from 'react-player';
import {
  Mic, MicOff, Video, VideoOff, Link as LinkIcon,
  Send, Users, MessageSquare, Crown, Copy, Check,
  ShieldCheck, ShieldOff, MonitorUp, MonitorX, Maximize2
} from 'lucide-react';

const SOCKET_URL = 'http://localhost:5000';
const EMOJIS = ['❤️', '😂', '🔥', '👍', '😮', '🎉', '💜', '🥺'];

/* ── Peer Video Tile ─────────────────────────────── */
const PeerVideo = ({ peer, name }) => {
  const ref = useRef();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    peer.on('stream', stream => { if (ref.current) ref.current.srcObject = stream; });
  }, [peer]);

  return (
    <div 
      className={`participant-tile ${isFullscreen ? 'fullscreen-tile' : ''}`}
      onDoubleClick={() => setIsFullscreen(!isFullscreen)}
      title="Double-click to toggle fullscreen"
    >
      <video playsInline autoPlay ref={ref} />
      <div className="tile-label">
        <span>{name}</span>
      </div>
      <div className="tile-controls" style={{ left: '6px', right: 'auto' }}>
        <button className="tile-ctrl-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  );
};

/* ── Toast Component ──────────────────────────────── */
const Toast = ({ toast, onAction }) => (
  <div className={`toast ${toast.type}-toast`}>
    <div className="toast-title">{toast.title}</div>
    <div className="toast-body">{toast.body}</div>
    {toast.actions && (
      <div className="toast-actions">
        {toast.actions.map(a => (
          <button key={a.label} className={`btn ${a.style}`} style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            onClick={() => onAction(toast.id, a.key)}>
            {a.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

/* ── Avatar helper ───────────────────────────────── */
const initials = (name) => name ? name.slice(0, 2).toUpperCase() : '??';

/* ── Room ─────────────────────────────────────────── */
const Room = () => {
  const { roomId } = useParams();
  const { state } = useLocation();
  const userName = state?.userName || 'Anonymous';

  // ── State ─────────────────────────────────────────
  const [isHost, setIsHost] = useState(false);
  const [hasControl, setHasControl] = useState(false); // guest granted control
  const [controlPending, setControlPending] = useState(false); // guest waiting for approval
  const [ownerId, setOwnerId] = useState(null);

  const [peers, setPeers] = useState([]);
  const [participants, setParticipants] = useState([]);

  const [videoUrl, setVideoUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const [reactions, setReactions] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' | 'people'
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localFullscreen, setLocalFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Refs ───────────────────────────────────────────
  const socketRef = useRef();
  const myVideoRef = useRef();
  const streamRef = useRef(null);
  const peersRef = useRef([]);
  const playerRef = useRef(null);
  const isInternalSeek = useRef(false);
  const chatBottomRef = useRef(null);

  const canControl = isHost || hasControl;

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Toast helpers ──────────────────────────────────
  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    if (!toast.persistent) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── WebRTC helpers ─────────────────────────────────
  const createPeer = useCallback((userToSignal, callerID, stream) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on('signal', signal => {
      socketRef.current.emit('sending-signal', { userToSignal, callerID, signal });
    });
    return peer;
  }, []);

  const addPeer = useCallback((incomingSignal, callerID, stream) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on('signal', signal => {
      socketRef.current.emit('returning-signal', { signal, callerID });
    });
    peer.signal(incomingSignal);
    return peer;
  }, []);

  // ── Main effect ────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { forceNew: true });
    socketRef.current = socket;
    let isMounted = true;

    // ── Room state ───────────────────────────────
    socket.on('room-state', (state) => {
      setVideoUrl(state.videoUrl);
      setInputUrl(state.videoUrl);
      setIsPlaying(state.isPlaying);
      setOwnerId(state.ownerId);
      setParticipants(state.users || []);
      const iAmHost = state.ownerId === socket.id;
      setIsHost(iAmHost);
      if (iAmHost) setHasControl(true); // host always has control
      if (state.time > 0) {
        setTimeout(() => playerRef.current?.seekTo(state.time, 'seconds'), 800);
      }
    });

    socket.on('users-update', users => setParticipants(users));

    socket.on('user-joined', user => {
      addToast({ type: 'info', title: '👋 Someone joined', body: `${user.name} entered the room.` });
    });

    socket.on('user-left', id => {
      const peerObj = peersRef.current.find(p => p.peerID === id);
      if (peerObj) peerObj.peer.destroy();
      peersRef.current = peersRef.current.filter(p => p.peerID !== id);
      setPeers(prev => prev.filter(p => p.peerID !== id));
    });

    // ── WebRTC ───────────────────────────────────
    socket.on('all-users', users => {
      const peersData = users.map(u => {
        const peer = createPeer(u.id, socket.id, streamRef.current);
        peersRef.current.push({ peerID: u.id, peer, name: u.name });
        return { peerID: u.id, peer, name: u.name };
      });
      setPeers(peersData);
    });

    socket.on('user-joined-webrtc', payload => {
      const peer = addPeer(payload.signal, payload.callerID, streamRef.current);
      const entry = { peerID: payload.callerID, peer, name: payload.name };
      peersRef.current.push(entry);
      setPeers(prev => [...prev, entry]);
    });

    socket.on('receiving-returned-signal', payload => {
      const item = peersRef.current.find(p => p.peerID === payload.id);
      if (item) item.peer.signal(payload.signal);
    });

    // ── Host transfer ────────────────────────────
    socket.on('you-are-now-host', () => {
      setIsHost(true); setHasControl(true); setOwnerId(socket.id);
      addToast({ type: 'granted', title: '👑 You are now the Host!', body: 'The previous host left. You have full control.' });
    });

    socket.on('host-changed', newHostId => {
      setOwnerId(newHostId);
      setParticipants(prev => prev.map(p => ({ ...p, isOwner: p.id === newHostId })));
    });

    // ── Chat ─────────────────────────────────────
    socket.on('chat-message', msg => {
      setMessages(prev => [...prev, msg]);
    });

    // ── Reactions ────────────────────────────────
    socket.on('receive-reaction', ({ reaction }) => {
      const id = Date.now() + Math.random();
      const x = 10 + Math.random() * 80; // % from left
      setReactions(prev => [...prev, { id, emoji: reaction, x }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3500);
    });

    // ── Video Sync ───────────────────────────────
    socket.on('play-video', time => {
      isInternalSeek.current = true;
      playerRef.current?.seekTo(time, 'seconds');
      setIsPlaying(true);
    });
    socket.on('pause-video', time => {
      isInternalSeek.current = true;
      playerRef.current?.seekTo(time, 'seconds');
      setIsPlaying(false);
    });
    socket.on('seek-video', time => {
      isInternalSeek.current = true;
      playerRef.current?.seekTo(time, 'seconds');
    });
    socket.on('change-video', url => {
      setVideoUrl(url); setInputUrl(url); setIsPlaying(false);
    });

    // ── Permission Events ────────────────────────
    socket.on('control-request', ({ userId, userName: reqName }) => {
      addToast({
        type: 'request',
        title: '🎮 Control Request',
        body: `${reqName} wants to control the video.`,
        persistent: true,
        actions: [
          { label: '✅ Allow', key: `grant:${userId}`, style: 'btn-success' },
          { label: '❌ Deny',  key: `deny:${userId}`,  style: 'btn-danger'  },
        ],
      });
    });

    socket.on('control-granted', () => {
      setHasControl(true); setControlPending(false);
      addToast({ type: 'granted', title: '✅ Control Granted!', body: 'The host gave you control. You can now manage the video.' });
    });
    socket.on('control-denied', () => {
      setControlPending(false);
      addToast({ type: 'denied', title: '❌ Request Denied', body: 'The host declined your control request.' });
    });
    socket.on('control-released', ({ userName: relName }) => {
      addToast({ type: 'info', title: '🎮 Control Released', body: `${relName} returned control.` });
    });
    socket.on('control-granted-announce', ({ userId }) => {
      setParticipants(prev => prev.map(p => ({ ...p, hasControl: p.id === userId })));
    });

    const init = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (myVideoRef.current) myVideoRef.current.srcObject = mediaStream;
      } catch (err) {
        console.warn('Camera/mic unavailable:', err.message);
        if (!isMounted) return;
      }

      socket.emit('join-room', roomId, userName);
    };

    init();

    return () => {
      isMounted = false;
      socket.removeAllListeners();
      socket.disconnect();
      streamRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(p => p.peer.destroy());
      peersRef.current = [];
    };
  }, [roomId, userName, createPeer, addPeer, addToast]);

  // ── Toast action handler ───────────────────────────
  const handleToastAction = (toastId, key) => {
    removeToast(toastId);
    if (key.startsWith('grant:')) {
      const targetId = key.replace('grant:', '');
      socketRef.current.emit('grant-control', targetId);
    } else if (key.startsWith('deny:')) {
      const targetId = key.replace('deny:', '');
      socketRef.current.emit('deny-control', targetId);
    }
  };

  // ── Video player callbacks ─────────────────────────
  const handlePlay = () => {
    if (isInternalSeek.current) { isInternalSeek.current = false; return; }
    if (!canControl) return;
    setIsPlaying(true);
    socketRef.current.emit('play-video', playerRef.current?.getCurrentTime() || 0);
  };

  const handlePause = () => {
    if (isInternalSeek.current) { isInternalSeek.current = false; return; }
    if (!canControl) return;
    setIsPlaying(false);
    socketRef.current.emit('pause-video', playerRef.current?.getCurrentTime() || 0);
  };

  // ── URL Change ─────────────────────────────────────
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (!canControl || !inputUrl.trim()) return;
    socketRef.current.emit('change-video', inputUrl.trim());
  };

  // ── Chat ───────────────────────────────────────────
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current.emit('chat-message', chatInput.trim());
    setChatInput('');
  };

  // ── Reactions ──────────────────────────────────────
  const sendReaction = (emoji) => socketRef.current.emit('send-reaction', emoji);

  // ── Permission ─────────────────────────────────────
  const requestControl = () => {
    if (controlPending) return;
    setControlPending(true);
    socketRef.current.emit('request-control');
    addToast({ type: 'info', title: '⏳ Request Sent', body: 'Waiting for the host to approve your control request…' });
  };

  const releaseControl = () => {
    setHasControl(false);
    socketRef.current.emit('release-control');
  };

  // ── Mic / Cam / Screen ─────────────────────────────
  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    setMicOn(p => !p);
  };
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    setCamOn(p => !p);
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const videoTrack = screenStream.getVideoTracks()[0];
        
        // Replace track for all peers
        peersRef.current.forEach(p => {
          const oldTrack = streamRef.current.getVideoTracks()[0];
          p.peer.replaceTrack(oldTrack, videoTrack, streamRef.current);
        });

        // Replace local track
        streamRef.current.removeTrack(streamRef.current.getVideoTracks()[0]);
        streamRef.current.addTrack(videoTrack);
        
        setIsScreenSharing(true);
        setCamOn(true); // Ensure cam icon matches track status

        // When user stops sharing via browser UI
        videoTrack.onended = async () => {
          setIsScreenSharing(false);
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const camTrack = camStream.getVideoTracks()[0];
          
          peersRef.current.forEach(p => {
            const currentTrack = streamRef.current.getVideoTracks()[0];
            p.peer.replaceTrack(currentTrack, camTrack, streamRef.current);
          });
          streamRef.current.removeTrack(streamRef.current.getVideoTracks()[0]);
          streamRef.current.addTrack(camTrack);
        };
      } else {
        // Manually stop sharing
        const currentTrack = streamRef.current.getVideoTracks()[0];
        currentTrack.stop();
        setIsScreenSharing(false);
        
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        
        peersRef.current.forEach(p => {
          p.peer.replaceTrack(currentTrack, camTrack, streamRef.current);
        });
        streamRef.current.removeTrack(currentTrack);
        streamRef.current.addTrack(camTrack);
      }
    } catch (err) {
      console.warn('Screen share failed or cancelled:', err);
    }
  };

  // ── Copy Room ID ───────────────────────────────────
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="room-layout">
        {/* ── Top Bar ─────────────────────────────────────── */}
        <header className="topbar">
          <span className="topbar-logo brand-font">Lovable</span>
          <div className="topbar-divider" />

          {/* Room Badge */}
          <div className="room-badge" onClick={copyRoomId} title="Click to copy Room ID">
            <span>Room:</span>
            <strong style={{ fontFamily: 'monospace' }}>{roomId}</strong>
            {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={13} style={{ color: 'var(--text-muted)' }} />}
          </div>

          {isHost && (
            <div className="badge badge-host">
              <Crown size={11} /> Host
            </div>
          )}
          {!isHost && hasControl && (
            <div className="badge badge-control">
              <ShieldCheck size={11} /> Has Control
            </div>
          )}

          <div className="topbar-spacer" />

          {/* URL Bar — disabled for guests without control */}
          <form className="url-form" onSubmit={handleUrlSubmit} title={canControl ? '' : 'Request control to change the video'}>
            <LinkIcon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={canControl ? 'Paste video URL (YouTube, MP4, Vimeo…)' : '🔒 Only the host can change the video'}
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              disabled={!canControl}
            />
            {canControl && (
              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '8px' }}>
                Load
              </button>
            )}
          </form>
        </header>

        {/* ── Main Area ────────────────────────────────────── */}
        <main className="main-area">
          {/* Video Player */}
          <div className="video-wrapper">
            {videoUrl ? (
              <ReactPlayer
                ref={playerRef}
                url={videoUrl}
                width="100%" height="100%"
                playing={isPlaying}
                controls={canControl}
                onPlay={handlePlay}
                onPause={handlePause}
                config={{
                  youtube: { playerVars: { rel: 0, disablekb: canControl ? 0 : 1 } },
                  file: { attributes: { controlsList: 'nodownload' } },
                }}
              />
            ) : (
              <div className="video-empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <p>
                  {canControl
                    ? 'Paste a video URL in the top bar to start watching'
                    : 'Waiting for the host to load a video…'}
                </p>
              </div>
            )}

            {/* Reaction stage */}
            <div className="reaction-stage">
              {reactions.map(r => (
                <div key={r.id} className="floating-emoji" style={{ left: `${r.x}%` }}>{r.emoji}</div>
              ))}
            </div>
          </div>

          {/* Participant Cams */}
          <div className="participants-strip">
            {/* Local cam */}
            <div 
              className={`participant-tile local ${localFullscreen ? 'fullscreen-tile' : ''}`}
              onDoubleClick={() => setLocalFullscreen(!localFullscreen)}
              title="Double-click to toggle fullscreen"
            >
              <video muted ref={myVideoRef} autoPlay playsInline />
              <div className="tile-label">
                {isHost && <Crown size={11} style={{ color: '#fbbf24' }} />}
                {userName} (You)
              </div>
              
              <div className="tile-controls" style={{ left: '6px', right: 'auto' }}>
                <button className="tile-ctrl-btn" onClick={() => setLocalFullscreen(!localFullscreen)}>
                  <Maximize2 size={12} />
                </button>
              </div>

              <div className="tile-controls">
                <button className={`tile-ctrl-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare} title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
                  {isScreenSharing ? <MonitorX size={13} /> : <MonitorUp size={13} />}
                </button>
                <button className={`tile-ctrl-btn ${!micOn ? 'off' : ''}`} onClick={toggleMic} title={micOn ? 'Mute' : 'Unmute'}>
                  {micOn ? <Mic size={13} /> : <MicOff size={13} />}
                </button>
                <button className={`tile-ctrl-btn ${!camOn ? 'off' : ''}`} onClick={toggleCam} title={camOn ? 'Camera off' : 'Camera on'}>
                  {camOn ? <Video size={13} /> : <VideoOff size={13} />}
                </button>
              </div>
            </div>

            {/* Remote peers */}
            {peers.map(p => <PeerVideo key={p.peerID} peer={p.peer} name={p.name} />)}
          </div>
        </main>

        {/* ── Sidebar ──────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${sidebarTab === 'chat' ? 'active' : ''}`} onClick={() => setSidebarTab('chat')}>
              <MessageSquare size={15} /> Chat
            </button>
            <button className={`sidebar-tab ${sidebarTab === 'people' ? 'active' : ''}`} onClick={() => setSidebarTab('people')}>
              <Users size={15} /> People ({participants.length})
            </button>
          </div>

          {/* ── Chat Tab ──────────────────────────────────── */}
          {sidebarTab === 'chat' && (
            <div className="chat-panel">
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="msg-empty">
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                    <p>No messages yet.</p>
                    <p>Say hello to the room!</p>
                  </div>
                )}
                {messages.map(m => (
                  <div key={m.id} className={`message ${m.sender === userName ? 'self' : ''}`}>
                    <div className="msg-meta">
                      <span style={{ color: m.sender === userName ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
                        {m.sender === userName ? 'You' : m.sender}
                        {m.senderId === ownerId && <Crown size={10} style={{ color: '#fbbf24', marginLeft: '3px' }} />}
                      </span>
                      <span>{m.time}</span>
                    </div>
                    <div className="msg-bubble">{m.text}</div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* Reactions */}
              <div className="reaction-bar">
                {EMOJIS.map(e => (
                  <button key={e} className="reaction-btn" onClick={() => sendReaction(e)} title={e}>{e}</button>
                ))}
              </div>

              {/* Chat Input */}
              <form className="chat-input-row" onSubmit={sendChat}>
                <input
                  className="input"
                  type="text"
                  placeholder="Say something…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}

          {/* ── People Tab ────────────────────────────────── */}
          {sidebarTab === 'people' && (
            <div className="participants-panel">
              {participants.map(p => (
                <div className="participant-row" key={p.id}>
                  <div className="participant-avatar">{initials(p.name)}</div>
                  <div className="participant-info">
                    <strong>{p.name}{p.id === socketRef.current?.id ? ' (You)' : ''}</strong>
                    <span>
                      {p.isOwner
                        ? '👑 Host'
                        : p.hasControl
                          ? '🎮 Has Control'
                          : '👤 Viewer'}
                    </span>
                  </div>
                  {p.isOwner && <div className="badge badge-host"><Crown size={10} />Host</div>}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── Toast Stack ─────────────────────────────────── */}
      <div className="toast-stack">
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onAction={handleToastAction} />
        ))}
      </div>

      {/* ── Control Request Banner (guests) ─────────────── */}
      {!isHost && !hasControl && !controlPending && (
        <div className="control-banner">
          <ShieldOff size={18} style={{ color: 'var(--text-muted)' }} />
          <span>You're in viewer mode.</span>
          <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }} onClick={requestControl}>
            🎮 Request Control
          </button>
        </div>
      )}
      {!isHost && !hasControl && controlPending && (
        <div className="control-banner" style={{ borderColor: 'rgba(245,158,11,0.5)' }}>
          <span style={{ fontSize: '1.1rem' }}>⏳</span>
          <span>Waiting for host approval…</span>
          <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            onClick={() => { setControlPending(false); socketRef.current.emit('release-control'); }}>
            Cancel
          </button>
        </div>
      )}
      {!isHost && hasControl && (
        <div className="control-banner" style={{ borderColor: 'rgba(16,185,129,0.5)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>You have video control</span>
          <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={releaseControl}>
            Release
          </button>
        </div>
      )}
    </>
  );
};

export default Room;
