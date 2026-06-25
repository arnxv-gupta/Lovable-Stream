# 🎬 SyncStream — Watch Party App

A real-time watch party platform where multiple people can watch videos together with synchronized playback, video calls (WebRTC), live chat, and emoji reactions.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎥 Synced Video Playback | Play/pause/seek stays in sync for everyone in the room |
| 🔗 Any Video URL | YouTube, MP4, Vimeo, Twitch, and more via `react-player` |
| 📹 Video Call | WebRTC-powered camera/mic streaming (like Google Meet) |
| 💬 Live Chat | Real-time chat with timestamps via Socket.IO |
| 😂 Reactions | Floating emoji reactions that appear for everyone |
| 🎙️ Mic/Cam Controls | Toggle your microphone and camera mid-session |
| 🏠 Room System | Create/join any room with a custom Room ID |

---

## 🚀 Quick Start

### Run both servers with one click:
```
Double-click start.bat
```

### Or manually:

**Terminal 1 — Backend:**
```bash
cd backend
node server.js
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open → [http://localhost:5174](http://localhost:5174)

---

## 👥 How to Use

1. **Host opens** `http://localhost:5174`
2. **Host enters** their name and a Room ID (e.g. `movie-night`)
3. **Friends run the same code** on their machines and open `http://localhost:5174`
4. **Friends join** with the **same Room ID**
5. **Paste any video URL** in the top bar → everyone sees the same video in sync
6. Chat, react with emojis, and talk via the built-in video call!

---

## 🏗️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| Styling | Vanilla CSS (glassmorphism dark theme) |
| Video Player | `react-player` (YouTube, MP4, Vimeo, etc.) |
| Video Call | `simple-peer` (WebRTC) |
| Real-time | `socket.io` + `socket.io-client` |
| Backend | Node.js + Express |

---

## 📁 Project Structure

```
Lovable/
├── backend/
│   ├── server.js       # Express + Socket.IO server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── JoinRoom.jsx  # Login/join screen
│   │   │   └── Room.jsx      # Main watch party room
│   │   ├── App.jsx
│   │   └── index.css   # All styling
│   └── vite.config.js
└── start.bat           # One-click launcher
```

---

## ⚠️ Notes

- This is **localhost-only** — all users must run the same code on their machines
- The backend runs on **port 5000**, frontend on **port 5174**
- Camera/microphone access requires **HTTPS or localhost** (already satisfied)
- For video sync to work properly, all users should be on the same LAN or use localhost
