import { useState } from 'react';
import { Dices, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AvatarPreview from './AvatarPreview';
import { LOOKS, PALETTES, randomAvatar, sanitizeAvatar } from '../../lib/game/skins';

const TURNS = ['down', 'right', 'up', 'left'];
// The colour parts the player can change, in the order they are shown, and their label keys.
const PARTS = [
  ['skin', 'skin'],
  ['hairColor', 'hair_color'],
  ['outfitColor', 'outfit_color'],
  ['accentColor', 'accent_color'],
  ['legsColor', 'legs_color'],
];

function Swatches({ label, originalLabel, colors, value, onChange }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <button
            key={c || 'original'}
            type="button"
            onClick={() => onChange(i)}
            aria-pressed={value === i}
            aria-label={c ? `${label} ${i}` : `${label}: ${originalLabel}`}
            title={c ? undefined : originalLabel}
            className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 transition ${value === i ? 'scale-110 border-white' : 'border-white/15 hover:border-white/50'} ${c ? '' : 'border-dashed bg-white/5'}`}
            style={c ? { background: c } : undefined}
          >
            {!c && <RotateCcw className="h-4 w-4 text-white/70" aria-hidden />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Controlled character editor: `value` is an avatar config, `onChange` receives the next one. */
export default function AvatarCreator({ value, onChange }) {
  const { t } = useTranslation();
  const avatar = sanitizeAvatar(value);
  const [turn, setTurn] = useState(0);
  const set = (part) => (v) => onChange({ ...avatar, [part]: v });

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex h-[300px] w-[240px] items-end justify-center rounded-3xl border border-white/10 pb-3"
          style={{ background: 'radial-gradient(circle at 50% 85%, #8b5cf633, transparent 65%), #0a0910' }}
        >
          <AvatarPreview avatar={avatar} dir={TURNS[turn]} walking scale={5} label={t('game.creator.preview_label')} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTurn((x) => (x + 1) % TURNS.length)}
            className="min-h-11 rounded-full border border-white/15 px-4 text-xs font-bold text-white/80 transition hover:bg-white/10">
            {t('game.creator.turn')}
          </button>
          <button type="button" onClick={() => onChange(randomAvatar())}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold text-white/80 transition hover:bg-white/10">
            <Dices className="h-4 w-4" aria-hidden /> {t('game.creator.randomize')}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{t('game.creator.look')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LOOKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onChange({ ...avatar, look: l.id })}
                aria-pressed={avatar.look === l.id}
                className={`flex min-h-11 flex-col items-center gap-1 rounded-xl border-2 px-1 pb-2 pt-1 transition ${avatar.look === l.id ? 'border-[#c6ff3d] bg-[#c6ff3d]/10' : 'border-white/15 hover:border-white/50'}`}
              >
                <AvatarPreview avatar={{ ...avatar, look: l.id }} scale={2} />
                <span className="text-[11px] font-bold leading-tight text-white/80">{t(`game.creator.looks.${l.id}`)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {PARTS.map(([part, key]) => (
          <Swatches key={part} label={t(`game.creator.${key}`)} originalLabel={t('game.creator.original')} colors={PALETTES[part]} value={avatar[part]} onChange={set(part)} />
        ))}
      </div>
    </div>
  );
}
