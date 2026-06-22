import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, Polyline, useJsApiLoader } from '@react-google-maps/api';
import type { Trip } from '../types';
import { getTrip } from '../lib/trips';
import { GOOGLE_MAPS_LIBRARIES } from '../lib/maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!tripId) return;
    getTrip(tripId)
      .then(setTrip)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [tripId]);

  if (error) return <div className="page error-banner">{error}</div>;
  if (!trip) return <div className="page">Loading…</div>;

  const path = (trip.route ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude }));
  const mid = path[Math.floor(path.length / 2)] ?? path[0];

  return (
    <div className="page">
      <h1>Trip Details</h1>

      {path.length > 1 && isLoaded && (
        <div className="map-wrap detail-map">
          <GoogleMap mapContainerClassName="map" center={mid} zoom={14}>
            <Polyline path={path} options={{ strokeColor: '#2563eb', strokeWeight: 4 }} />
          </GoogleMap>
        </div>
      )}

      <div className="detail-stats">
        {trip.source === 'manual' && (
          <>
            <Row label="From" value={trip.origin_address ?? '-'} />
            <Row label="To" value={trip.destination_address ?? '-'} />
          </>
        )}
        <Row label="Started" value={new Date(trip.started_at).toLocaleString()} />
        <Row label="Ended" value={trip.ended_at ? new Date(trip.ended_at).toLocaleString() : '-'} />
        <Row label="Duration" value={formatDuration(trip.duration_seconds ?? 0)} />
        <Row label="Distance" value={`${trip.distance_km?.toFixed(2)} km`} />
        {trip.source !== 'manual' && (
          <>
            <Row label="Avg speed" value={`${trip.avg_speed_kmh?.toFixed(1)} km/h`} />
            <Row label="Max speed" value={`${trip.max_speed_kmh?.toFixed(1)} km/h`} />
          </>
        )}
        <Row label="Fuel average" value={`${trip.fuel_avg_km_per_liter} km/l`} />
        <Row label="Fuel price" value={`KES ${trip.fuel_price_per_liter}/l`} />
        <Row label="Fuel used" value={`${trip.fuel_liters_used?.toFixed(2)} L`} />
        <Row label="Fuel cost" value={`KES ${trip.fuel_cost?.toFixed(2)}`} highlight />
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${highlight ? 'highlight' : ''}`}>{value}</span>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}
