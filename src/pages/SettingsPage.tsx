import { useEffect, useState } from 'react';
import type { UserSettings } from '../types';
import { getSettings, updateSettings } from '../lib/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [fuelAvg, setFuelAvg] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setFuelAvg(String(s.fuel_avg_km_per_liter));
      setFuelPrice(String(s.fuel_price_per_liter));
    });
  }, []);

  async function handleSave() {
    if (!settings) return;
    const avg = parseFloat(fuelAvg);
    const price = parseFloat(fuelPrice);
    if (Number.isNaN(avg) || Number.isNaN(price) || avg <= 0 || price <= 0) {
      setError('Enter valid positive numbers.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSettings(settings.id, avg, price);
      setMessage('Fuel settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1>Fuel Settings</h1>

      <label className="field-label">Fuel average (km per litre)</label>
      <input
        className="field-input"
        value={fuelAvg}
        onChange={(e) => setFuelAvg(e.target.value)}
        placeholder="e.g. 11"
        inputMode="decimal"
      />

      <label className="field-label">Fuel price (KES per litre)</label>
      <input
        className="field-input"
        value={fuelPrice}
        onChange={(e) => setFuelPrice(e.target.value)}
        placeholder="e.g. 211"
        inputMode="decimal"
      />

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <button className="big-button start" onClick={handleSave} disabled={saving || !settings}>
        {saving ? 'Saving…' : 'Save'}
      </button>

      <p className="hint">
        These values are used to calculate fuel cost for every new trip you record.
        Update them whenever fuel prices change.
      </p>
    </div>
  );
}
