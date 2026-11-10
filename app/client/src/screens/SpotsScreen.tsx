// SC-03 スポット（index.html の spots）。季節タブ・地図・概要シート（R-008〜R-010・R-012）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { seasonOf } from '../../../shared/dates.ts';
import { SEASONS, SPOTS, spotById, type Season, type Spot, type SpotId } from '../../../shared/master/spots.ts';
import { useApp } from '../app-context.ts';
import { useT, type T } from '../i18n/index.ts';
import type { MapSpot } from '../map/LeafletMap.tsx';
import { SpotMap } from '../map/SpotMap.tsx';
import { beep } from '../sfx.ts';
import { Frame } from '../ui/Frame.tsx';
import { Icon } from '../ui/Icon.tsx';

export function seasonOn(spot: Spot, season: Season): boolean {
  return spot.season === 'all' || spot.season === season;
}

export function mapSpots(t: T, L: (p: readonly [string, string]) => string, season: Season, selected: SpotId | null): MapSpot[] {
  return SPOTS.map((spot) => {
    const on = seasonOn(spot, season);
    const seasonText = t(spot.season);
    return {
      spot,
      look: { on, selected: spot.id === selected, seasonText, name: L(spot.name) },
      label: `${L(spot.name)}、${seasonText}${on ? '' : t('otherSeason')}`,
    };
  });
}

/** 詳細から戻ったときに、選んでいた季節を残す */
const memory: { season: Season | null } = { season: null };

export function SpotsScreen() {
  const { me, go } = useApp();
  const { t, L } = useT();
  const [season, setSeason] = useState<Season>(memory.season ?? seasonOf(me.today));
  const [selected, setSelected] = useState<SpotId | null>(null);
  const spots = useMemo(() => mapSpots(t, L, season, selected), [t, L, season, selected]);

  useEffect(() => {
    memory.season = season;
  }, [season]);

  const pickSeason = (s: Season) => {
    setSeason(s);
    setSelected(null);
    beep('tap');
  };
  const open = (id: SpotId) => go('detail', id);
  const from = me.demo?.location ? spotById(me.demo.location) : null;
  const here = useMemo(() => (from ? { lat: from.lat, lng: from.lng, label: t('hereDemo') } : null), [from, t]);

  return (
    <Frame title={t('spots')} flush>
      <div className="seasons" role="group" aria-label={t('season')}>
        {SEASONS.map((s) => (
          <button key={s} type="button" className="sz" aria-pressed={season === s} data-testid={`season-${s}`} onClick={() => pickSeason(s)}>
            <Icon name={s} size={20} />{t(s)}
          </button>
        ))}
      </div>
      <SpotMap spots={spots} selected={selected} onSelect={(id) => { setSelected(id); beep('tap'); }} here={here} />
      {selected && <SpotSheet id={selected} onClose={() => setSelected(null)} onOpen={open} />}
    </Frame>
  );
}

function SpotSheet({ id, onClose, onOpen }: { id: SpotId; onClose: () => void; onOpen: (id: SpotId) => void }) {
  const { t, L } = useT();
  const s = spotById(id);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    head.current?.focus();
  }, [id]);
  return (
    <section className="sheet anim" role="dialog" aria-labelledby="sheet-h" data-testid="sheet"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="grab" aria-hidden="true" />
      <div className="hd">
        <h2 id="sheet-h" ref={head} tabIndex={-1}>{L(s.name)}</h2>
        <button type="button" className="ib" aria-label={t('close')} onClick={onClose}><Icon name="close" size={22} sw={2.5} /></button>
      </div>
      <div className="bd">
        <div className="row wrap6">
          <span className="chip">{L(s.cat)}</span>
          <span className="chip gold"><Icon name={s.season} size={14} sw={2.5} />{t(s.season)}</span>
          {s.stepFree && <span className="chip gold">{t('stepLess')}</span>}
        </div>
        <p><b>{L(s.ev)}</b> — {L(s.short)}</p>
        {s.real && <p className="muted">{t('realShort')}</p>}
      </div>
      <button type="button" className="btn primary" data-testid="sheet-detail" onClick={() => onOpen(id)}>
        {t('detailBtn')}<Icon name="chev" size={22} sw={2.5} />
      </button>
    </section>
  );
}
