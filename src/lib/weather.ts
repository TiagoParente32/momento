// Weather via Open-Meteo (https://open-meteo.com) – free, no API key, CORS enabled.
import { getItem, setItem, KEYS } from './storage';
import type { GeoLocation } from './types';

export class WeatherError extends Error {
  constructor(message: string, public kind: 'network' | 'http' | 'parse' | 'geolocation' | 'notfound', public status?: number) {
    super(message);
    this.name = 'WeatherError';
  }
}

export type IconName = 'Sun' | 'Moon' | 'CloudSun' | 'CloudMoon' | 'Cloud' | 'CloudFog' | 'CloudDrizzle' | 'CloudRain' | 'CloudSnow' | 'CloudLightning' | 'Snowflake' | 'CloudHail';

/** WMO weather interpretation codes → label & icon. */
export function describeCode(code: number, isDay = true): { label: string; icon: IconName } {
  const d = isDay;
  if (code === 0) return { label: d ? 'Clear sky' : 'Clear night', icon: d ? 'Sun' : 'Moon' };
  if (code === 1) return { label: 'Mainly clear', icon: d ? 'CloudSun' : 'CloudMoon' };
  if (code === 2) return { label: 'Partly cloudy', icon: d ? 'CloudSun' : 'CloudMoon' };
  if (code === 3) return { label: 'Overcast', icon: 'Cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'CloudFog' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'CloudDrizzle' };
  if (code === 56 || code === 57) return { label: 'Freezing drizzle', icon: 'CloudDrizzle' };
  if (code === 61) return { label: 'Light rain', icon: 'CloudRain' };
  if (code === 63) return { label: 'Rain', icon: 'CloudRain' };
  if (code === 65) return { label: 'Heavy rain', icon: 'CloudRain' };
  if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'CloudHail' };
  if (code === 71) return { label: 'Light snow', icon: 'CloudSnow' };
  if (code === 73) return { label: 'Snow', icon: 'CloudSnow' };
  if (code === 75) return { label: 'Heavy snow', icon: 'Snowflake' };
  if (code === 77) return { label: 'Snow grains', icon: 'Snowflake' };
  if (code >= 80 && code <= 82) return { label: code === 82 ? 'Violent showers' : 'Rain showers', icon: 'CloudRain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'CloudSnow' };
  if (code === 95) return { label: 'Thunderstorm', icon: 'CloudLightning' };
  if (code === 96 || code === 99) return { label: 'Thunderstorm with hail', icon: 'CloudLightning' };
  return { label: 'Unknown', icon: 'Cloud' };
}

export interface WeatherData {
  fetchedAt: number;
  timezone: string;
  current: {
    time: string;
    temp: number;
    apparent: number;
    humidity: number;
    windSpeed: number;
    windDir: number;
    code: number;
    isDay: boolean;
    precipitation: number;
  };
  hourly: { time: string; temp: number; code: number; precipProb: number; isDay: boolean }[];
  daily: { date: string; max: number; min: number; code: number; precipProb: number; sunrise: string; sunset: string; uvMax: number }[];
  air: { europeanAqi: number | null; usAqi: number | null; pm25: number | null; pm10: number | null } | null;
  units: { temp: string; wind: string };
}

async function getJSON(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new WeatherError('Could not reach the weather service. Check your connection.', 'network');
  }
  if (!res.ok) throw new WeatherError(`Weather service error (${res.status})`, 'http', res.status);
  try {
    return await res.json();
  } catch {
    throw new WeatherError('Unexpected response from weather service', 'parse');
  }
}

export async function searchLocations(query: string, count = 8): Promise<GeoLocation[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`);
  return (data.results ?? []).map((r: any) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? 'auto',
  }));
}

export function locationLabel(l: GeoLocation) {
  return [l.name, l.admin1 && l.admin1 !== l.name ? l.admin1 : null, l.country].filter(Boolean).join(', ');
}

/** Use the browser geolocation API, then resolve a timezone/name via a forecast call. */
export function currentPosition(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new WeatherError('Geolocation is not available in this browser.', 'geolocation'));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        try {
          const d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=auto&forecast_days=1`);
          if (d.timezone) timezone = d.timezone;
        } catch { /* keep browser tz */ }
        const city = timezone.includes('/') ? timezone.split('/').pop()!.replace(/_/g, ' ') : 'My location';
        resolve({ name: `My location`, admin1: city, latitude: +latitude.toFixed(4), longitude: +longitude.toFixed(4), timezone });
      },
      (err) => reject(new WeatherError(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not determine your location.', 'geolocation')),
      { timeout: 15000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

const CACHE_MS = 20 * 60 * 1000;
type Cache = Record<string, WeatherData>;

export async function getWeather(loc: GeoLocation, unit: 'c' | 'f', force = false): Promise<WeatherData> {
  const key = `${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)},${unit}`;
  const cache = (await getItem<Cache>(KEYS.weatherCache)) ?? {};
  const hit = cache[key];
  if (!force && hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit;

  const tu = unit === 'f' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '';
  const base = `latitude=${loc.latitude}&longitude=${loc.longitude}&timezone=auto`;
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?${base}${tu}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,precipitation' +
    '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
    '&forecast_days=7&forecast_hours=24';
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${base}&current=european_aqi,us_aqi,pm2_5,pm10`;

  const [f, a] = await Promise.all([getJSON(forecastUrl), getJSON(airUrl).catch(() => null)]);
  if (!f?.current || !f?.hourly || !f?.daily) throw new WeatherError('Incomplete weather data', 'parse');

  const data: WeatherData = {
    fetchedAt: Date.now(),
    timezone: f.timezone,
    current: {
      time: f.current.time,
      temp: f.current.temperature_2m,
      apparent: f.current.apparent_temperature,
      humidity: f.current.relative_humidity_2m,
      windSpeed: f.current.wind_speed_10m,
      windDir: f.current.wind_direction_10m,
      code: f.current.weather_code,
      isDay: !!f.current.is_day,
      precipitation: f.current.precipitation,
    },
    hourly: f.hourly.time.map((t: string, i: number) => ({
      time: t,
      temp: f.hourly.temperature_2m[i],
      code: f.hourly.weather_code[i],
      precipProb: f.hourly.precipitation_probability?.[i] ?? 0,
      isDay: !!f.hourly.is_day?.[i],
    })),
    daily: f.daily.time.map((d: string, i: number) => ({
      date: d,
      max: f.daily.temperature_2m_max[i],
      min: f.daily.temperature_2m_min[i],
      code: f.daily.weather_code[i],
      precipProb: f.daily.precipitation_probability_max?.[i] ?? 0,
      sunrise: f.daily.sunrise[i],
      sunset: f.daily.sunset[i],
      uvMax: f.daily.uv_index_max?.[i] ?? 0,
    })),
    air: a?.current
      ? { europeanAqi: a.current.european_aqi ?? null, usAqi: a.current.us_aqi ?? null, pm25: a.current.pm2_5 ?? null, pm10: a.current.pm10 ?? null }
      : null,
    units: { temp: unit === 'f' ? '°F' : '°C', wind: unit === 'f' ? 'mph' : 'km/h' },
  };

  // keep the cache small
  const next: Cache = { [key]: data };
  for (const [k, v] of Object.entries(cache)) if (k !== key && Date.now() - v.fetchedAt < CACHE_MS && Object.keys(next).length < 6) next[k] = v;
  await setItem(KEYS.weatherCache, next);
  return data;
}

/** European AQI categories (EEA). */
export function aqiCategory(eaqi: number): { label: string; color: string } {
  if (eaqi <= 20) return { label: 'Good', color: '#22c55e' };
  if (eaqi <= 40) return { label: 'Fair', color: '#84cc16' };
  if (eaqi <= 60) return { label: 'Moderate', color: '#eab308' };
  if (eaqi <= 80) return { label: 'Poor', color: '#f97316' };
  if (eaqi <= 100) return { label: 'Very poor', color: '#ef4444' };
  return { label: 'Extremely poor', color: '#a855f7' };
}

export const windDirection = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

/** Open-Meteo returns local-time strings ('2026-11-22T14:00') in the location tz. Format the clock part directly. */
export function formatLocalTime(iso: string, h24: boolean) {
  const [, t] = iso.split('T');
  if (!t) return iso;
  const [hh, mm] = t.split(':').map(Number);
  if (h24) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const h = hh % 12 || 12;
  return mm ? `${h}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}` : `${h} ${hh >= 12 ? 'PM' : 'AM'}`;
}
