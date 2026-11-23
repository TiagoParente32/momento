import { useRef, useState } from 'react';
import { Sun, Moon, Monitor, SkipForward, Pin, PinOff, Upload, Trash2, Check } from 'lucide-react';
import { Button, ColorPicker, Field, Segmented, Select, Toggle, toast } from '@/components/ui';
import { useS, useSettings } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { ACCENTS, BACKGROUND_CATEGORIES, FONT_OPTIONS, GRADIENTS, PHOTOS, photoUrl } from '@/lib/appearance';
import { cn, uid } from '@/lib/utils';
import type { BackgroundCategory, Settings } from '@/lib/types';
import { Group, Row, Section } from './common';

/** Resize an uploaded image to ≤2560px and encode as JPEG data URL. */
function resizeImage(file: File, max = 2560): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file'));
    if (file.size > 25 * 1024 * 1024) return reject(new Error('Image is larger than 25 MB'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

export function AppearanceSection() {
  const s = useS();
  const { update } = useSettings.getState();
  const bgAccent = useUI((u) => u.bgAccent);
  const bgCredit = useUI((u) => u.bgCredit);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const currentPhotoId = bgCredit?.link?.split('/photos/')[1] ?? null;
  const pinned = s.pinnedBackground;

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added = [];
      for (const f of Array.from(files).slice(0, 10)) added.push({ id: uid(), name: f.name, dataUrl: await resizeImage(f) });
      update({ customBackgrounds: [...s.customBackgrounds, ...added], backgroundMode: 'custom' });
      toast(`Added ${added.length} photo${added.length > 1 ? 's' : ''}`, 'success');
    } catch (e: any) { toast(e?.message ?? 'Upload failed', 'error'); } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleCategory = (c: BackgroundCategory) => {
    const has = s.backgroundCategories.includes(c);
    const next = has ? s.backgroundCategories.filter((x) => x !== c) : [...s.backgroundCategories, c];
    if (!next.length) { toast('Keep at least one category', 'error'); return; }
    update({ backgroundCategories: next });
  };

  return (
    <Section title="Appearance" description="Make Momento feel like yours.">
      <Group title="Theme">
        <Segmented<Settings['theme']> value={s.theme} onChange={(theme) => update({ theme })}
          options={[
            { value: 'light', label: <span className="flex items-center gap-1"><Sun className="h-3.5 w-3.5" /> Light</span> },
            { value: 'dark', label: <span className="flex items-center gap-1"><Moon className="h-3.5 w-3.5" /> Dark</span> },
            { value: 'auto', label: <span className="flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> System</span> },
          ]} />
      </Group>

      <Group title="Accent colour">
        <Toggle checked={s.autoAccent} onChange={(autoAccent) => update({ autoAccent })} label="Match background photo"
          description={<span className="flex items-center gap-1.5">Derive the accent from the current background{bgAccent && <span className="inline-block h-3 w-3 rounded-full" style={{ background: bgAccent }} />}</span>} />
        <div className={cn(s.autoAccent && 'pointer-events-none opacity-40')}>
          <ColorPicker value={s.accent} onChange={(accent) => update({ accent, autoAccent: false })} colors={ACCENTS} />
        </div>
      </Group>

      <Group title="Fonts">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Display (clock & headings)">
            <Select value={s.fontDisplay} onChange={(e) => update({ fontDisplay: e.target.value })}>
              {Object.entries(FONT_OPTIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </Select>
          </Field>
          <Field label="Body text">
            <Select value={s.fontBody} onChange={(e) => update({ fontBody: e.target.value })}>
              {Object.entries(FONT_OPTIONS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </Select>
          </Field>
        </div>
        <p className="font-display text-2xl" style={{ fontFamily: FONT_OPTIONS[s.fontDisplay]?.css }}>Make every moment count.</p>
        <p className="text-xs text-muted">Fonts load from Google Fonts; the system font is used offline.</p>
      </Group>

      <Group title="Background">
        <Segmented<Settings['backgroundMode']> value={s.backgroundMode} onChange={(backgroundMode) => update({ backgroundMode })}
          options={[{ value: 'photo', label: 'Photos' }, { value: 'custom', label: 'My photos' }, { value: 'gradient', label: 'Gradient' }, { value: 'solid', label: 'Solid' }]} />

        {s.backgroundMode === 'photo' && (
          <>
            <div>
              <span className="label">Categories</span>
              <div className="flex flex-wrap gap-1.5">
                {BACKGROUND_CATEGORIES.map((c) => {
                  const on = s.backgroundCategories.includes(c.value);
                  return (
                    <button key={c.value} onClick={() => toggleCategory(c.value)} aria-pressed={on}
                      className={cn('chip py-1 transition', on ? 'bg-accent text-white' : 'bg-ink/5 text-muted hover:bg-ink/10')}>
                      {on && <Check className="h-3 w-3" />} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Row label="Rotation" description="How often a new photo appears">
              <Select value={s.backgroundRotation} onChange={(e) => update({ backgroundRotation: e.target.value as Settings['backgroundRotation'] })} className="w-40">
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
                <option value="tab">Every new tab</option>
              </Select>
            </Row>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { if (pinned) update({ pinnedBackground: null }); window.dispatchEvent(new Event('momento:next-bg')); }}>
                <SkipForward className="h-3.5 w-3.5" /> Next photo
              </Button>
              {pinned && PHOTOS.some((p) => p.id === pinned) ? (
                <Button size="sm" variant="ghost" onClick={() => update({ pinnedBackground: null })}><PinOff className="h-3.5 w-3.5" /> Unpin photo</Button>
              ) : (
                <Button size="sm" variant="ghost" disabled={!currentPhotoId} onClick={() => currentPhotoId && update({ pinnedBackground: currentPhotoId })}><Pin className="h-3.5 w-3.5" /> Pin current photo</Button>
              )}
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-muted">Choose a specific photo</summary>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {PHOTOS.filter((p) => s.backgroundCategories.includes(p.category)).map((p) => (
                  <button key={p.id} onClick={() => update({ pinnedBackground: p.id })} title={`${p.author} · ${p.category}`}
                    className={cn('aspect-video overflow-hidden rounded-lg bg-ink/10 ring-offset-2 ring-offset-surface', pinned === p.id && 'ring-2 ring-accent')}>
                    <img src={photoUrl(p.id, 320)} alt={`${p.category} photo by ${p.author}`} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </details>
          </>
        )}

        {s.backgroundMode === 'custom' && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files)} />
            <Button size="sm" variant="primary" loading={uploading} onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Upload photos</Button>
            {s.customBackgrounds.length === 0 ? (
              <p className="text-xs text-muted">No photos yet. Uploads are resized and stored on this device.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {s.customBackgrounds.map((b) => (
                  <div key={b.id} className={cn('group relative aspect-video overflow-hidden rounded-lg ring-offset-2 ring-offset-surface', pinned === b.id && 'ring-2 ring-accent')}>
                    <img src={b.dataUrl} alt={b.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <button className="rounded-md bg-white/90 p-1 text-zinc-900" aria-label={pinned === b.id ? 'Unpin' : 'Always show this photo'}
                        onClick={() => update({ pinnedBackground: pinned === b.id ? null : b.id })}>
                        {pinned === b.id ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      <button className="rounded-md bg-white/90 p-1 text-red-600" aria-label="Delete photo"
                        onClick={() => update({ customBackgrounds: s.customBackgrounds.filter((x) => x.id !== b.id), pinnedBackground: pinned === b.id ? null : pinned })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {s.backgroundMode === 'gradient' && (
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(GRADIENTS).map(([k, g]) => (
              <button key={k} onClick={() => update({ gradient: k })} aria-pressed={s.gradient === k}
                className={cn('flex aspect-video items-end rounded-lg p-1.5 text-left text-[11px] font-medium text-white ring-offset-2 ring-offset-surface', s.gradient === k && 'ring-2 ring-accent')}
                style={{ background: g.css }}>
                {g.label}
              </button>
            ))}
          </div>
        )}

        {s.backgroundMode === 'solid' && (
          <ColorPicker value={s.solidColor} onChange={(solidColor) => update({ solidColor })} colors={['#0f172a', '#1e293b', '#27272a', '#1f2937', '#312e81', '#064e3b', '#7c2d12', '#f5f5f4']} />
        )}

        <Row label="Dim background" description="Improves text contrast">
          <input type="range" min={0} max={0.7} step={0.05} value={s.dimBackground} onChange={(e) => update({ dimBackground: Number(e.target.value) })} className="w-40" aria-label="Dim background" />
        </Row>
        <Toggle checked={s.blurWidgets} onChange={(blurWidgets) => update({ blurWidgets })} label="Frosted glass widgets" description="Turn off for better performance on slower devices" />
      </Group>

      <Group title="Clock & units">
        <Toggle checked={s.clock24h} onChange={(clock24h) => update({ clock24h })} label="24-hour clock" />
        <Toggle checked={s.showSeconds} onChange={(showSeconds) => update({ showSeconds })} label="Show seconds" />
        <Row label="Temperature">
          <Segmented value={s.tempUnit} onChange={(tempUnit) => update({ tempUnit })} options={[{ value: 'c', label: '°C' }, { value: 'f', label: '°F' }]} />
        </Row>
        <Row label="Week starts on">
          <Segmented value={String(s.weekStartsOn) as '0' | '1'} onChange={(v) => update({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
        </Row>
      </Group>
    </Section>
  );
}
