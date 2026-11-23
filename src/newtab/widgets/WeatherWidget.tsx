import { MapPin, AlertCircle } from 'lucide-react';
import { useUI } from '@/stores/ui';
import { describeCode } from '@/lib/weather';
import { WeatherIcon, useWeather } from './weatherShared';

export default function WeatherWidget() {
  const openPanel = useUI((u) => u.openPanel);
  const { data, loading, error, location } = useWeather();

  if (!location) {
    return (
      <button onClick={() => openPanel('weather')} className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-sm hover:bg-white/15">
        <MapPin className="h-4 w-4" /> Set location for weather
      </button>
    );
  }

  return (
    <button onClick={() => openPanel('weather')} className="group flex items-center gap-3 rounded-2xl px-3 py-2 text-right transition hover:bg-white/10" aria-label="Open weather details">
      {error && !data ? (
        <span className="flex items-center gap-1.5 text-sm text-white/80"><AlertCircle className="h-4 w-4" /> Weather unavailable</span>
      ) : !data ? (
        <span className="h-10 w-28 animate-pulse rounded-xl bg-white/15" aria-label="Loading weather" />
      ) : (
        <>
          <WeatherIcon code={data.current.code} isDay={data.current.isDay} className="h-9 w-9" strokeWidth={1.5} />
          <span>
            <span className="block text-3xl font-medium leading-none tabular-nums">
              {Math.round(data.current.temp)}°
            </span>
            <span className="mt-1 block text-xs text-white/80">
              {describeCode(data.current.code, data.current.isDay).label} · {location.name === 'My location' ? location.admin1 ?? location.name : location.name}
              {loading && ' …'}
            </span>
          </span>
        </>
      )}
    </button>
  );
}
