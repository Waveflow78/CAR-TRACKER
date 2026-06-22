export type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  speedKmh: number | null;
};

export type TripSource = 'gps' | 'manual';

export type Trip = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_km: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  route: RoutePoint[];
  fuel_avg_km_per_liter: number | null;
  fuel_price_per_liter: number | null;
  fuel_liters_used: number | null;
  fuel_cost: number | null;
  source: TripSource;
  origin_address: string | null;
  destination_address: string | null;
  created_at: string;
};

export type UserSettings = {
  id: string;
  fuel_avg_km_per_liter: number;
  fuel_price_per_liter: number;
  updated_at: string;
};
