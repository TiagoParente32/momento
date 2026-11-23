import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Snowflake, CloudHail, type LucideProps } from 'lucide-react';
import { describeCode, getWeather, WeatherError, type IconName, type WeatherData } from '@/lib/weather';
import { useS } from '@/stores/settings';

const ICONS: Record<IconName, ComponentType<LucideProps>> = { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Snowflake, CloudHail };

export function WeatherIcon({ code, isDay = true, ...props }: { code: number; isDay?: boolean } & LucideProps) {
  const I = ICONS[describeCode(code, isDay).icon];
  return <I aria-hidden {...props} />;
}

/** Load weather for the configured location; refreshes every 20 minutes. */
export function useWeather() {
  const s = useS();
  const loc = s.location;
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!loc) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await getWeather(loc, s.tempUnit, force));
    } catch (e) {
      setError(e instanceof WeatherError ? e.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, [loc?.latitude, loc?.longitude, s.tempUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  return { data, loading, error, reload: () => load(true), location: loc };
}
