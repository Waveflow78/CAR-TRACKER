import type { RoutePoint } from '../types';

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function totalRouteDistanceKm(route: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversineDistanceKm(route[i - 1], route[i]);
  }
  return total;
}

export function calculateFuelCost(
  distanceKm: number,
  fuelAvgKmPerLiter: number,
  fuelPricePerLiter: number
): { litersUsed: number; cost: number } {
  const litersUsed = fuelAvgKmPerLiter > 0 ? distanceKm / fuelAvgKmPerLiter : 0;
  const cost = litersUsed * fuelPricePerLiter;
  return { litersUsed, cost };
}
