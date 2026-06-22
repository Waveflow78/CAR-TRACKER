import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import TrackPage from './pages/TrackPage';
import HistoryPage from './pages/HistoryPage';
import TripDetailPage from './pages/TripDetailPage';
import SettingsPage from './pages/SettingsPage';
import { TrackIcon, HistoryIcon, SettingsIcon } from './components/icons';
import './App.css';

const NAV_ITEMS = [
  { to: '/', label: 'Track', icon: TrackIcon, end: true },
  { to: '/history', label: 'History', icon: HistoryIcon, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

function App() {
  const location = useLocation();
  const isFullBleed = location.pathname === '/';

  return (
    <div className="app-shell">
      <header className="top-nav">
        <span className="brand">
          <span className="brand-badge">CT</span>
          Car Trip Tracker
        </span>
        <nav className="top-nav-links">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon className="top-nav-icon" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={isFullBleed ? 'main-full-bleed' : undefined}>
        <Routes>
          <Route path="/" element={<TrackPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav-item">
            <Icon className="bottom-nav-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default App;
