import { supabase } from './supabase';
import type { Trip, RoutePoint, TripSource } from '../types';

export async function saveTrip(trip: {
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  route: RoutePoint[];
  fuelAvgKmPerLiter: number;
  fuelPricePerLiter: number;
  fuelLitersUsed: number;
  fuelCost: number;
  source?: TripSource;
  originAddress?: string;
  destinationAddress?: string;
}): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      started_at: trip.startedAt,
      ended_at: trip.endedAt,
      duration_seconds: trip.durationSeconds,
      distance_km: trip.distanceKm,
      avg_speed_kmh: trip.avgSpeedKmh,
      max_speed_kmh: trip.maxSpeedKmh,
      route: trip.route,
      fuel_avg_km_per_liter: trip.fuelAvgKmPerLiter,
      fuel_price_per_liter: trip.fuelPricePerLiter,
      fuel_liters_used: trip.fuelLitersUsed,
      fuel_cost: trip.fuelCost,
      source: trip.source ?? 'gps',
      origin_address: trip.originAddress ?? null,
      destination_address: trip.destinationAddress ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Trip;
}

export async function listTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('started_at', { ascending: false });

  if (error) throw error;
  return data as Trip[];
}

export async function getTrip(id: string): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Trip;
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw error;
}
