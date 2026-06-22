import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import TrackPage from './pages/TrackPage';
import PlanTripPage from './pages/PlanTripPage';
import HistoryPage from './pages/HistoryPage';
import TripDetailPage from './pages/TripDetailPage';
import SettingsPage from './pages/SettingsPage';
import { TrackIcon, PlanIcon, HistoryIcon, SettingsIcon } from './components/icons';
import './App.css';

const NAV_ITEMS = [
  { to: '/', label: 'Track', icon: TrackIcon, end: true },
  { to: '/plan', label: 'Plan', icon: PlanIcon, end: false },
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
          <span className="brand-dot" />
          Car Trip Tracker
        </span>
        <nav className="top-nav-links">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={isFullBleed ? 'main-full-bleed' : undefined}>
        <Routes>
          <Route path="/" element={<TrackPage />} />
          <Route path="/plan" element={<PlanTripPage />} />
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
