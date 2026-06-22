import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  DirectionsRenderer,
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';
import type { RoutePoint, UserSettings } from '../types';
import { totalRouteDistanceKm, calculateFuelCost } from '../lib/geo';
import { getSettings } from '../lib/settings';
import { saveTrip } from '../lib/trips';
import { GOOGLE_MAPS_LIBRARIES } from '../lib/maps';
import { PlanIcon } from '../components/icons';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };

type Stop = { id: string; text: string };

export default function TrackPage() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [settings, setSettings] = useState<UserSettings | null>(null);

  // ---- live GPS tracking ----
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const startedAtRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- route planner ----
  const [showPlanner, setShowPlanner] = useState(false);
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [plannedDirections, setPlannedDirections] = useState<google.maps.DirectionsResult | null>(
    null
  );
  const [plannedDistanceKm, setPlannedDistanceKm] = useState<number | null>(null);
  const [plannedDurationSeconds, setPlannedDurationSeconds] = useState<number | null>(null);

  const originAutoRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destAutoRef = useRef<google.maps.places.Autocomplete | null>(null);
  const stopAutoRefs = useRef<Map<string, google.maps.places.Autocomplete>>(new Map());

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fillOriginFromCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocateError('Geolocation is not supported in this browser.');
      return;
    }
    setLocatingOrigin(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          setLocatingOrigin(false);
          if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
            setOriginText(results[0].formatted_address);
          } else {
            setOriginText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        });
      },
      (err) => {
        setLocatingOrigin(false);
        setLocateError(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  useEffect(() => {
    if (isLoaded) fillOriginFromCurrentLocation();
  }, [isLoaded, fillOriginFromCurrentLocation]);

  function addStop() {
    setStops((prev) => [...prev, { id: crypto.randomUUID(), text: '' }]);
  }

  function updateStop(id: string, text: string) {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }

  function removeStop(id: string) {
    setStops((prev) => prev.filter((s) => s.id !== id));
    stopAutoRefs.current.delete(id);
  }

  const handlePreviewRoute = useCallback(() => {
    if (!originText.trim() || !destinationText.trim()) {
      setPreviewError('Enter both a starting point and a destination.');
      return;
    }

    setPreviewError(null);
    setPreviewLoading(true);

    const waypoints = stops
      .filter((s) => s.text.trim())
      .map((s) => ({ location: s.text, stopover: true }));

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: originText,
        destination: destinationText,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setPreviewLoading(false);
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          console.error('Directions request failed', status, { originText, destinationText, waypoints });
          setPreviewError(`Could not find a route (${status}). ${directionsStatusHint(status)}`);
          return;
        }
        const legs = result.routes[0]?.legs ?? [];
        if (legs.length === 0) {
          setPreviewError('Route found but distance/duration is unavailable.');
          return;
        }
        const totalMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
        const totalSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);

        setPlannedDirections(result);
        setPlannedDistanceKm(totalMeters / 1000);
        setPlannedDurationSeconds(totalSeconds);
        setShowPlanner(false);
      }
    );
  }, [originText, destinationText, stops]);

  function clearPlan() {
    setPlannedDirections(null);
    setPlannedDistanceKm(null);
    setPlannedDurationSeconds(null);
    setPreviewError(null);
  }

  const handleStart = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setTrackError('Geolocation is not supported in this browser.');
      return;
    }

    setTrackError(null);
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
        setTrackError(err.message);
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
      setTrackError('Trip too short — not enough GPS points were recorded.');
      return;
    }

    setSaving(true);
    setTrackError(null);
    try {
      const currentSettings = settings ?? (await getSettings());
      const distanceKm = totalRouteDistanceKm(route);
      const speeds = route.map((p) => p.speedKmh ?? 0).filter((s) => s > 0);
      const avgSpeedKmh =
        speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      const maxSpeedKmh = speeds.length > 0 ? Math.max(...speeds) : 0;
      const { litersUsed, cost } = calculateFuelCost(
        distanceKm,
        currentSettings.fuel_avg_km_per_liter,
        currentSettings.fuel_price_per_liter
      );

      await saveTrip({
        startedAt: startedAtRef.current!,
        endedAt: new Date().toISOString(),
        durationSeconds: elapsedSeconds,
        distanceKm,
        avgSpeedKmh,
        maxSpeedKmh,
        route,
        fuelAvgKmPerLiter: currentSettings.fuel_avg_km_per_liter,
        fuelPricePerLiter: currentSettings.fuel_price_per_liter,
        fuelLitersUsed: litersUsed,
        fuelCost: cost,
        originAddress: originText || undefined,
        destinationAddress: destinationText || undefined,
        stopsAddresses: stops.map((s) => s.text).filter((t) => t.trim()),
      });

      clearPlan();
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [route, elapsedSeconds, settings, originText, destinationText, stops]);

  const last = route[route.length - 1];
  const liveDistanceKm = totalRouteDistanceKm(route);
  const livePath = route.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  const hasLiveRoute = isTracking || route.length > 0;

  const plannedFuelEstimate =
    settings && plannedDistanceKm !== null
      ? calculateFuelCost(plannedDistanceKm, settings.fuel_avg_km_per_liter, settings.fuel_price_per_liter)
      : null;

  return (
    <div className="page track-page">
      <div className="map-wrap">
        {isLoaded ? (
          <GoogleMap
            mapContainerClassName="map"
            center={last ? { lat: last.latitude, lng: last.longitude } : DEFAULT_CENTER}
            zoom={last ? 16 : 13}
          >
            {hasLiveRoute ? (
              <>
                {livePath.length > 1 && (
                  <Polyline path={livePath} options={{ strokeColor: '#b6f23c', strokeWeight: 5 }} />
                )}
                {last && <Marker position={{ lat: last.latitude, lng: last.longitude }} />}
              </>
            ) : (
              plannedDirections && (
                <DirectionsRenderer
                  directions={plannedDirections}
                  options={{ polylineOptions: { strokeColor: '#ff8a3d', strokeWeight: 5 } }}
                />
              )
            )}
          </GoogleMap>
        ) : (
          <div className="map-loading">Loading map…</div>
        )}

        {trackError && <div className="map-error-toast">{trackError}</div>}
        {isTracking && <span className="rec-pill">● Recording</span>}

        {!isTracking && (
          <button className="plan-toggle" onClick={() => setShowPlanner((v) => !v)}>
            <PlanIcon className="plan-toggle-icon" />
            {plannedDistanceKm !== null
              ? `${plannedDistanceKm.toFixed(1)} km planned`
              : 'Plan a route'}
          </button>
        )}

        {showPlanner && (
          <div className="planner-panel">
            <div className="planner-header">
              <span>Plan a Route</span>
              <button className="planner-close" onClick={() => setShowPlanner(false)}>
                ✕
              </button>
            </div>

            <div className="field-label-row">
              <label className="field-label">Starting point</label>
              <button
                type="button"
                className="link-button"
                onClick={fillOriginFromCurrentLocation}
                disabled={locatingOrigin}
              >
                {locatingOrigin ? 'Locating…' : 'Use current location'}
              </button>
            </div>
            <Autocomplete
              onLoad={(ac) => (originAutoRef.current = ac)}
              onPlaceChanged={() => {
                const place = originAutoRef.current?.getPlace();
                if (place?.formatted_address) setOriginText(place.formatted_address);
              }}
            >
              <input
                className="field-input"
                value={originText}
                onChange={(e) => setOriginText(e.target.value)}
                placeholder="e.g. Westlands, Nairobi"
              />
            </Autocomplete>
            {locateError && <div className="error-banner">{locateError}</div>}

            {stops.map((stop, idx) => (
              <div key={stop.id}>
                <div className="field-label-row">
                  <label className="field-label">Stop {idx + 1}</label>
                  <button type="button" className="link-button" onClick={() => removeStop(stop.id)}>
                    Remove
                  </button>
                </div>
                <Autocomplete
                  onLoad={(ac) => stopAutoRefs.current.set(stop.id, ac)}
                  onPlaceChanged={() => {
                    const place = stopAutoRefs.current.get(stop.id)?.getPlace();
                    if (place?.formatted_address) updateStop(stop.id, place.formatted_address);
                  }}
                >
                  <input
                    className="field-input"
                    value={stop.text}
                    onChange={(e) => updateStop(stop.id, e.target.value)}
                    placeholder="e.g. Fuel station"
                  />
                </Autocomplete>
              </div>
            ))}

            <button type="button" className="link-button add-stop-button" onClick={addStop}>
              + Add stop
            </button>

            <label className="field-label">Destination</label>
            <Autocomplete
              onLoad={(ac) => (destAutoRef.current = ac)}
              onPlaceChanged={() => {
                const place = destAutoRef.current?.getPlace();
                if (place?.formatted_address) setDestinationText(place.formatted_address);
              }}
            >
              <input
                className="field-input"
                value={destinationText}
                onChange={(e) => setDestinationText(e.target.value)}
                placeholder="e.g. Jomo Kenyatta International Airport"
              />
            </Autocomplete>

            {previewError && <div className="error-banner">{previewError}</div>}

            <button
              className="big-button start"
              onClick={handlePreviewRoute}
              disabled={previewLoading || !isLoaded}
            >
              {previewLoading ? 'Calculating…' : 'Preview Route'}
            </button>

            {plannedDistanceKm !== null && (
              <button className="link-button" onClick={clearPlan}>
                Clear plan
              </button>
            )}
          </div>
        )}
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
        {hasLiveRoute ? (
          <>
            <Stat label="Time" value={formatDuration(elapsedSeconds)} />
            <Stat label="Distance" value={`${liveDistanceKm.toFixed(2)} km`} />
            <Stat label="Speed" value={`${currentSpeedKmh.toFixed(0)} km/h`} />
          </>
        ) : plannedDistanceKm !== null ? (
          <>
            <Stat label="Planned" value={`${plannedDistanceKm.toFixed(2)} km`} />
            <Stat label="Est. time" value={formatDuration(plannedDurationSeconds ?? 0)} />
            <Stat
              label="Est. cost"
              value={plannedFuelEstimate ? `KES ${plannedFuelEstimate.cost.toFixed(0)}` : '—'}
            />
          </>
        ) : (
          <>
            <Stat label="Time" value="00:00:00" />
            <Stat label="Distance" value="0.00 km" />
            <Stat label="Speed" value="0 km/h" />
          </>
        )}
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

function directionsStatusHint(status: google.maps.DirectionsStatus): string {
  switch (status) {
    case google.maps.DirectionsStatus.REQUEST_DENIED:
      return 'Your Google Maps API key is not authorized to use the Directions API.';
    case google.maps.DirectionsStatus.ZERO_RESULTS:
      return 'No driving route exists between those two points.';
    case google.maps.DirectionsStatus.NOT_FOUND:
      return 'One of the addresses could not be located.';
    case google.maps.DirectionsStatus.OVER_QUERY_LIMIT:
      return 'API quota/billing limit reached for this key.';
    case google.maps.DirectionsStatus.INVALID_REQUEST:
      return 'The request was malformed.';
    default:
      return 'Try a more specific address.';
  }
}
