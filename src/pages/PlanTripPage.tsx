import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  DirectionsRenderer,
  GoogleMap,
  useJsApiLoader,
} from '@react-google-maps/api';
import type { UserSettings } from '../types';
import { calculateFuelCost } from '../lib/geo';
import { getSettings } from '../lib/settings';
import { saveTrip } from '../lib/trips';
import { GOOGLE_MAPS_LIBRARIES } from '../lib/maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };

export default function PlanTripPage() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const originAutoRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destAutoRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
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

  const handleCalculate = useCallback(() => {
    if (!originText.trim() || !destinationText.trim()) {
      setError('Enter both a starting point and a destination.');
      return;
    }

    setError(null);
    setSaved(false);
    setLoading(true);

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: originText,
        destination: destinationText,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setLoading(false);
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          setError('Could not find a route between those locations.');
          return;
        }
        const leg = result.routes[0]?.legs[0];
        if (!leg || !leg.distance || !leg.duration) {
          setError('Route found but distance/duration is unavailable.');
          return;
        }
        setDirections(result);
        setDistanceKm(leg.distance.value / 1000);
        setDurationSeconds(leg.duration.value);
      }
    );
  }, [originText, destinationText]);

  async function handleSave() {
    if (!settings || distanceKm === null || durationSeconds === null || !directions) return;

    setSaving(true);
    setError(null);
    try {
      const { litersUsed, cost } = calculateFuelCost(
        distanceKm,
        settings.fuel_avg_km_per_liter,
        settings.fuel_price_per_liter
      );

      const overviewPath = directions.routes[0]?.overview_path ?? [];
      const route = overviewPath.map((p) => ({
        latitude: p.lat(),
        longitude: p.lng(),
        timestamp: Date.now(),
        speedKmh: null,
      }));

      const now = new Date().toISOString();
      await saveTrip({
        startedAt: now,
        endedAt: now,
        durationSeconds,
        distanceKm,
        avgSpeedKmh: 0,
        maxSpeedKmh: 0,
        route,
        fuelAvgKmPerLiter: settings.fuel_avg_km_per_liter,
        fuelPricePerLiter: settings.fuel_price_per_liter,
        fuelLitersUsed: litersUsed,
        fuelCost: cost,
        source: 'manual',
        originAddress: originText,
        destinationAddress: destinationText,
      });

      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const fuelEstimate =
    settings && distanceKm !== null
      ? calculateFuelCost(distanceKm, settings.fuel_avg_km_per_liter, settings.fuel_price_per_liter)
      : null;

  return (
    <div className="page">
      <h1>Plan a Trip</h1>

      {isLoaded ? (
        <>
          <div className="field-label-row">
            <label className="field-label">Starting point</label>
            <button
              type="button"
              className="link-button"
              onClick={fillOriginFromCurrentLocation}
              disabled={locatingOrigin}
            >
              {locatingOrigin ? 'Locating…' : 'Use my current location'}
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
        </>
      ) : (
        <p>Loading map…</p>
      )}

      {error && <div className="error-banner">{error}</div>}
      {saved && <div className="success-banner">Trip saved to your history.</div>}

      <button className="big-button start" onClick={handleCalculate} disabled={loading || !isLoaded}>
        {loading ? 'Calculating…' : 'Calculate Distance & Cost'}
      </button>

      {isLoaded && directions && (
        <div className="map-wrap detail-map">
          <GoogleMap mapContainerClassName="map" center={DEFAULT_CENTER} zoom={12}>
            <DirectionsRenderer directions={directions} />
          </GoogleMap>
        </div>
      )}

      {distanceKm !== null && fuelEstimate && (
        <div className="detail-stats">
          <Row label="Distance" value={`${distanceKm.toFixed(2)} km`} />
          <Row label="Estimated drive time" value={formatDuration(durationSeconds ?? 0)} />
          <Row label="Fuel average used" value={`${settings?.fuel_avg_km_per_liter} km/l`} />
          <Row label="Fuel price used" value={`KES ${settings?.fuel_price_per_liter}/l`} />
          <Row label="Fuel needed" value={`${fuelEstimate.litersUsed.toFixed(2)} L`} />
          <Row label="Estimated cost" value={`KES ${fuelEstimate.cost.toFixed(2)}`} highlight />
        </div>
      )}

      {distanceKm !== null && (
        <button className="big-button start" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save This Trip'}
        </button>
      )}
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
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
