import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Trip } from '../types';
import { listTrips } from '../lib/trips';

export default function HistoryPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTrips()
      .then(setTrips)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const todayTotals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysTrips = trips.filter((t) => new Date(t.started_at) >= today);
    return {
      count: todaysTrips.length,
      distanceKm: todaysTrips.reduce((sum, t) => sum + (t.distance_km ?? 0), 0),
      cost: todaysTrips.reduce((sum, t) => sum + (t.fuel_cost ?? 0), 0),
    };
  }, [trips]);

  return (
    <div className="page">
      <h1>Trip History</h1>

      {!loading && trips.length > 0 && (
        <div className="daily-summary">
          <div className="daily-summary-title">Today</div>
          <div className="daily-summary-row">
            <span>{todayTotals.count} trip{todayTotals.count === 1 ? '' : 's'}</span>
            <span>{todayTotals.distanceKm.toFixed(2)} km</span>
            <span className="cost">KES {todayTotals.cost.toFixed(2)}</span>
          </div>
        </div>
      )}

      {loading && <p>Loading…</p>}
      {error && <div className="error-banner">{error}</div>}
      {!loading && trips.length === 0 && <p className="empty">No trips yet. Start your first trip!</p>}

      <div className="trip-list">
        {trips.map((trip) => (
          <Link key={trip.id} to={`/trips/${trip.id}`} className="trip-card">
            <div className="trip-date">
              {new Date(trip.started_at).toLocaleString()}
              {trip.source === 'manual' && <span className="badge">Planned</span>}
            </div>
            <div className="trip-row">
              <span>{trip.distance_km?.toFixed(2)} km</span>
              <span>{formatDuration(trip.duration_seconds ?? 0)}</span>
              <span className="cost">KES {trip.fuel_cost?.toFixed(2)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}
