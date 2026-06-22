import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import type { RoutePoint } from '../types';
import { totalRouteDistanceKm, calculateFuelCost } from '../lib/geo';
import { getSettings } from '../lib/settings';
import { saveTrip } from '../lib/trips';
import { GOOGLE_MAPS_LIBRARIES } from '../lib/maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };

export default function TrackPage() {
  const navigate = useNavigate();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.');
      return;
    }

    setError(null);
    setRoute([]);
    setElapsedSeconds(0);
    setCurrentSpeedKmh(0);
    startedAtRef.current = new Date().toISOString();
    setIsTracking(true);

    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speedMs = pos.coords.speed ?? 0;
        const speedKmh = speedMs && speedMs > 0 ? speedMs * 3.6 : 0;
        setCurrentSpeedKmh(speedKmh);
        setRoute((prev) => [
          ...prev,
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: pos.timestamp,
            speedKmh,
          },
        ]);
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, []);

  const handleStop = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTracking(false);

    if (route.length < 2) {
      setError('Trip too short — not enough GPS points were recorded.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const settings = await getSettings();
      const distanceKm = totalRouteDistanceKm(route);
      const speeds = route.map((p) => p.speedKmh ?? 0).filter((s) => s > 0);
      const avgSpeedKmh =
        speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      const maxSpeedKmh = speeds.length > 0 ? Math.max(...speeds) : 0;
      const { litersUsed, cost } = calculateFuelCost(
        distanceKm,
        settings.fuel_avg_km_per_liter,
        settings.fuel_price_per_liter
      );

      await saveTrip({
        startedAt: startedAtRef.current!,
        endedAt: new Date().toISOString(),
        durationSeconds: elapsedSeconds,
        distanceKm,
        avgSpeedKmh,
        maxSpeedKmh,
        route,
        fuelAvgKmPerLiter: settings.fuel_avg_km_per_liter,
        fuelPricePerLiter: settings.fuel_price_per_liter,
        fuelLitersUsed: litersUsed,
        fuelCost: cost,
      });

      navigate('/history');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [route, elapsedSeconds, navigate]);

  const last = route[route.length - 1];
  const distanceSoFar = totalRouteDistanceKm(route);
  const path = route.map((p) => ({ lat: p.latitude, lng: p.longitude }));

  return (
    <div className="page track-page">
      <div className="map-wrap">
        {isLoaded ? (
          <GoogleMap
            mapContainerClassName="map"
            center={last ? { lat: last.latitude, lng: last.longitude } : DEFAULT_CENTER}
            zoom={last ? 16 : 13}
          >
            {path.length > 1 && (
              <Polyline path={path} options={{ strokeColor: '#2563eb', strokeWeight: 4 }} />
            )}
            {last && <Marker position={{ lat: last.latitude, lng: last.longitude }} />}
          </GoogleMap>
        ) : (
          <div className="map-loading">Loading map…</div>
        )}
        {error && <div className="map-error-toast">{error}</div>}
        {isTracking && <span className="rec-pill">● Recording</span>}
      </div>

      <div className="fab-wrap">
        {isTracking && <div className="fab-ring" />}
        <button
          className={`fab ${isTracking ? 'stop' : 'start'}`}
          onClick={isTracking ? handleStop : handleStart}
          disabled={saving}
        >
          {saving ? 'Saving…' : isTracking ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="stats-bar">
        <Stat label="Time" value={formatDuration(elapsedSeconds)} />
        <Stat label="Distance" value={`${distanceSoFar.toFixed(2)} km`} />
        <Stat label="Speed" value={`${currentSpeedKmh.toFixed(0)} km/h`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
