import { supabase } from './supabase';
import type { UserSettings } from '../types';

export async function getSettings(): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  return data as UserSettings;
}

export async function updateSettings(
  id: string,
  fuelAvgKmPerLiter: number,
  fuelPricePerLiter: number
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .update({
      fuel_avg_km_per_liter: fuelAvgKmPerLiter,
      fuel_price_per_liter: fuelPricePerLiter,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as UserSettings;
}
