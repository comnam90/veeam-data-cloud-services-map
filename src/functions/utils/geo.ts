/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula. Returns distance in both kilometers and miles.
 *
 * @param lat1 Latitude of first point in decimal degrees
 * @param lng1 Longitude of first point in decimal degrees
 * @param lat2 Latitude of second point in decimal degrees
 * @param lng2 Longitude of second point in decimal degrees
 * @returns Object with distance in kilometers and miles
 * @throws Error if coordinates are out of valid range
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { km: number; miles: number } {
  validateCoordinate(lat1, lng1, 'source')
  validateCoordinate(lat2, lng2, 'target')

  const EARTH_RADIUS_KM = 6371
  const KM_TO_MILES = 0.621371

  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = EARTH_RADIUS_KM * c
  const distanceMiles = distanceKm * KM_TO_MILES

  return {
    km: Math.round(distanceKm * 100) / 100,
    miles: Math.round(distanceMiles * 100) / 100,
  }
}

/**
 * Validate that coordinates are within valid ranges
 * @throws Error if coordinates are invalid
 */
function validateCoordinate(lat: number, lng: number, label: string): void {
  if (lat < -90 || lat > 90) {
    throw new Error(
      `Invalid ${label} latitude: ${lat}. Must be between -90 and 90.`
    )
  }
  if (lng < -180 || lng > 180) {
    throw new Error(
      `Invalid ${label} longitude: ${lng}. Must be between -180 and 180.`
    )
  }
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
