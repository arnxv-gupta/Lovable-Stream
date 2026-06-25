import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JoinRoom from './components/JoinRoom';
import Room from './components/Room';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<JoinRoom />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
