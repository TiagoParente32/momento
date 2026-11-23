import { useEffect, useState, type ReactNode } from 'react';
import { CloudSun, LocateFixed, MapPin, RefreshCw, Search, Sunrise, Sunset, Droplets, Wind, Thermometer, Gauge, AlertCircle } from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, IconButton, Input, Segmented, Spinner, toast } from '@/components/ui';
import { useS, useSettings } from '@/stores/settings';
import { aqiCategory, currentPosition, describeCode, formatLocalTime, locationLabel, searchLocations, windDirection, WeatherError } from '@/lib/weather';
import { WeatherIcon, useWeather } from '../widgets/weatherShared';
import { fromISODate } from '@/lib/utils';
import type { GeoLocation } from '@/lib/types';

export default function WeatherPanel() {
  const s = useS();
  const update = useSettings((st) => st.update);
  const { data, loading, error, reload, location } = useWeather();

  return (
    <PanelFrame
      title="Weather"
      icon={<CloudSun className="h-4 w-4" />}
      actions={
        <>
          <Segmented<'c' | 'f'> value={s.tempUnit} onChange={(v) => update({ tempUnit: v })} options={[{ value: 'c', label: '°C' }, { value: 'f', label: '°F' }]} />
          {location && <IconButton label="Refresh weather" onClick={reload} disabled={loading}><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></IconButton>}
        </>
      }
    >
      <div className="space-y-6 p-5">
        <LocationPicker current={location} onPick={(l) => update({ location: l, useGeolocation: l.name === 'My location' })} />

        {!location && <p className="text-sm text-muted">Search for a city or use your current location to see the forecast.</p>}

        {location && error && !data && (
          <div className="card flex items-center gap-3 p-4 text-sm">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="flex-1">{error}</span>
            <Button size="sm" onClick={reload}>Retry</Button>
          </div>
        )}

        {location && !data && !error && <div className="grid place-items-center py-16"><Spinner /></div>}

        {data && (
          <>
            <section className="card flex flex-wrap items-center gap-6 p-5">
              <WeatherIcon code={data.current.code} isDay={data.current.isDay} className="h-16 w-16 text-accent" strokeWidth={1.4} />
              <div className="flex-1">
                <p className="text-5xl font-semibold tabular-nums">{Math.round(data.current.temp)}{data.units.temp}</p>
                <p className="mt-1 text-sm text-muted">{describeCode(data.current.code, data.current.isDay).label} · {locationLabel(location!)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Stat icon={<Thermometer className="h-4 w-4" />} label="Feels like" value={`${Math.round(data.current.apparent)}°`} />
                <Stat icon={<Droplets className="h-4 w-4" />} label="Humidity" value={`${data.current.humidity}%`} />
                <Stat icon={<Wind className="h-4 w-4" />} label="Wind" value={`${Math.round(data.current.windSpeed)} ${data.units.wind} ${windDirection(data.current.windDir)}`} />
                <Stat icon={<Gauge className="h-4 w-4" />} label="UV max" value={String(Math.round(data.daily[0]?.uvMax ?? 0))} />
              </dl>
            </section>

            <section>
              <p className="section-title mb-2">Next 24 hours</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scroll-thin">
                {data.hourly.map((h, i) => (
                  <div key={h.time} className="card flex w-16 shrink-0 flex-col items-center gap-1 py-3 text-center">
                    <span className="text-xs text-muted">{i === 0 ? 'Now' : formatLocalTime(h.time, s.clock24h)}</span>
                    <WeatherIcon code={h.code} isDay={h.isDay} className="h-5 w-5" />
                    <span className="text-sm font-medium tabular-nums">{Math.round(h.temp)}°</span>
                    <span className="text-[10px] text-muted">{h.precipProb}%</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="section-title mb-2">7-day forecast</p>
              <DailyList days={data.daily} />
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="card flex items-center gap-4 p-4">
                <Sunrise className="h-6 w-6 text-amber-500" />
                <div className="flex-1 text-sm"><p className="text-muted">Sunrise</p><p className="font-medium">{formatLocalTime(data.daily[0].sunrise, s.clock24h)}</p></div>
                <Sunset className="h-6 w-6 text-orange-500" />
                <div className="flex-1 text-sm"><p className="text-muted">Sunset</p><p className="font-medium">{formatLocalTime(data.daily[0].sunset, s.clock24h)}</p></div>
              </div>
              <AirQuality air={data.air} />
            </section>
          </>
        )}

        <p className="text-xs text-muted">
          Weather data by <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Updated every 20 minutes.
        </p>
      </div>
    </PanelFrame>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd><span className="text-muted">{label}: </span><span className="font-medium">{value}</span></dd>
    </div>
  );
}

function DailyList({ days }: { days: { date: string; max: number; min: number; code: number; precipProb: number }[] }) {
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = hi - lo || 1;
  return (
    <ul className="card divide-y divide-line/10">
      {days.map((d, i) => (
        <li key={d.date} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="w-12 font-medium">{i === 0 ? 'Today' : fromISODate(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
          <WeatherIcon code={d.code} className="h-5 w-5" />
          <span className="w-10 text-xs text-muted">{d.precipProb ? `${d.precipProb}%` : ''}</span>
          <span className="w-8 text-right tabular-nums text-muted">{Math.round(d.min)}°</span>
          <span className="relative h-1.5 flex-1 rounded-full bg-ink/10" aria-hidden>
            <span className="absolute h-full rounded-full bg-accent" style={{ left: `${((d.min - lo) / span) * 100}%`, width: `${Math.max(4, ((d.max - d.min) / span) * 100)}%` }} />
          </span>
          <span className="w-8 tabular-nums">{Math.round(d.max)}°</span>
          <span className="sr-only">{describeCode(d.code).label}</span>
        </li>
      ))}
    </ul>
  );
}

function AirQuality({ air }: { air: { europeanAqi: number | null; usAqi: number | null; pm25: number | null; pm10: number | null } | null }) {
  if (!air || air.europeanAqi == null) return <div className="card p-4 text-sm text-muted">Air quality data is not available for this location.</div>;
  const cat = aqiCategory(air.europeanAqi);
  return (
    <div className="card flex items-center gap-4 p-4 text-sm">
      <span className="grid h-12 w-12 place-items-center rounded-full text-base font-semibold text-white" style={{ background: cat.color }} aria-hidden>
        {Math.round(air.europeanAqi)}
      </span>
      <div className="flex-1">
        <p className="text-muted">Air quality (European AQI)</p>
        <p className="font-medium">{cat.label}{air.usAqi != null && <span className="font-normal text-muted"> · US AQI {Math.round(air.usAqi)}</span>}</p>
        <p className="text-xs text-muted">PM2.5 {air.pm25?.toFixed(1) ?? '–'} · PM10 {air.pm10?.toFixed(1) ?? '–'} µg/m³</p>
      </div>
    </div>
  );
}

export function LocationPicker({ current, onPick }: { current: GeoLocation | null; onPick: (l: GeoLocation) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setBusy(true); setErr(null);
      try {
        const r = await searchLocations(q);
        setResults(r);
        if (!r.length) setErr('No places found');
      } catch (e) {
        setErr(e instanceof WeatherError ? e.message : 'Search failed');
      } finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const locate = async () => {
    setLocating(true); setErr(null);
    try {
      const l = await currentPosition();
      onPick(l);
      toast('Using your current location', 'success');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not get location');
    } finally { setLocating(false); }
  };

  return (
    <section>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={current ? `Change location (now: ${current.name === 'My location' ? current.admin1 : current.name})` : 'Search city…'} className="pl-9" aria-label="Search location" />
        </div>
        <Button onClick={locate} loading={locating}><LocateFixed className="h-4 w-4" /> Use my location</Button>
      </div>
      {busy && <p className="mt-2 text-xs text-muted">Searching…</p>}
      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      {results.length > 0 && (
        <ul className="card mt-2 divide-y divide-line/10" role="listbox">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink/5"
                onClick={() => { onPick(r); setQ(''); setResults([]); toast(`Location set to ${r.name}`, 'success'); }}
              >
                <MapPin className="h-4 w-4 text-muted" /> {locationLabel(r)}
                <span className="ml-auto text-xs text-muted">{r.timezone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
