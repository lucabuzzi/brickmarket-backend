import { useState } from 'react';
import { Dices, RotateCcw, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AvatarPreview from './AvatarPreview';
import { PALETTES, randomAvatar, sanitizeAvatar } from '../../lib/game/skins';
import { CHARACTER_INFO, creatorClasses, editableParts, memberOf } from '../../lib/game/characters';

const TURNS = ['down', 'right', 'up', 'left'];

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

/**
 * Controlled character editor: `value` is an avatar config, `onChange` receives the next one. The player picks a
 * class (a pair of characters, man and woman), then the colours of the zones that character really has.
 */
export default function AvatarCreator({ value, onChange }) {
  const { t } = useTranslation();
  const avatar = sanitizeAvatar(value);
  const info = CHARACTER_INFO[avatar.look];
  const classes = creatorClasses();
  const current = classes.find((c) => c.pair === info.pair) || classes[0];
  const [turn, setTurn] = useState(0);

  // sanitize again so the parts the new character cannot recolour go back to "as drawn"
  const change = (next) => onChange(sanitizeAvatar(next));
  const pickClass = (pair) => change({ ...avatar, look: memberOf(pair, info.gender) });
  const pickGender = (gender) => change({ ...avatar, look: memberOf(current.pair, gender) });

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-3">
        <div className="cbg-creator-stage">
          <AvatarPreview key={avatar.look} avatar={avatar} dir={TURNS[turn]} walking scale={5} label={t('game.creator.preview_label')} className="cbg-creator-hero" />
        </div>
        <div className="max-w-[240px] text-center" aria-live="polite">
          <p className="cbg-pixel text-[0.7rem] uppercase text-[#c6ff3d]">{t(`game.characters.${avatar.look}`)}</p>
          <p className="mt-1.5 text-xs leading-snug text-white/60">{t(`game.classes.${current.pair}.tagline`)}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTurn((x) => (x + 1) % TURNS.length)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold text-white/80 transition hover:bg-white/10">
            <RotateCw className="h-4 w-4" aria-hidden /> {t('game.creator.turn')}
          </button>
          <button type="button" onClick={() => change(randomAvatar())}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold text-white/80 transition hover:bg-white/10">
            <Dices className="h-4 w-4" aria-hidden /> {t('game.creator.randomize')}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{t('game.creator.class')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {classes.map((c) => {
              const on = c.pair === current.pair;
              const shown = on ? avatar.look : memberOf(c.pair, info.gender);
              return (
                <button
                  key={c.pair}
                  type="button"
                  onClick={() => pickClass(c.pair)}
                  aria-pressed={on}
                  className={`cbg-class-card ${on ? 'cbg-class-card--on' : ''}`}
                >
                  <AvatarPreview avatar={on ? avatar : { ...avatar, look: shown }} scale={2} />
                  <span className="text-[11px] font-black uppercase leading-tight tracking-wide text-white/85">{t(`game.classes.${c.pair}.name`)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {current.members.length > 1 && (
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{t('game.creator.gender')}</legend>
            <div className="inline-flex rounded-xl border-2 border-white/15 p-1" role="group">
              {['male', 'female'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => pickGender(g)}
                  aria-pressed={info.gender === g}
                  className={`min-h-11 rounded-lg px-5 text-xs font-black uppercase tracking-wide transition ${info.gender === g ? 'bg-[#c6ff3d] text-[#14111f]' : 'text-white/70 hover:bg-white/10'}`}
                >
                  {t(`game.creator.gender_${g}`)}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {editableParts(avatar.look).map(({ part, label }) => (
          <Swatches
            key={part}
            label={t(`game.creator.regions.${label}`)}
            originalLabel={t('game.creator.original')}
            colors={PALETTES[part]}
            value={avatar[part]}
            onChange={(v) => change({ ...avatar, [part]: v })}
          />
        ))}
      </div>
    </div>
  );
}
