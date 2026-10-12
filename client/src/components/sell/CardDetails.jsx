import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Field, { FieldGroup } from './FormField';
import ChoiceTile from './ChoiceTile';
import { inputCls } from './inputClass';
import {
  CARD_GRADE_MAX, CARD_LANGUAGES, CARD_RARITY_MAX, GRADING_COMPANIES, gradingCompanyLabel, languageName, raritySuggestions,
} from '../../lib/sell/cards';

// "Card details" block of the condition step (trading cards only): language, rarity, professional grading.
// `err(field)` returns the translated error for a field, or undefined.
export default function CardDetails({ form, patch, err, accent = 'lime', ns = 'sell', idPrefix = 'sell' }) {
  const { t, i18n } = useTranslation();
  const languages = useMemo(
    () => CARD_LANGUAGES.map((code) => ({ code, name: languageName(code, i18n.language) })).sort((a, b) => a.name.localeCompare(b.name, i18n.language)),
    [i18n.language],
  );
  const suggestions = raritySuggestions(form.game);
  const graded = !!form.gradingCompany;
  const id = (name) => `${idPrefix}-${name}`;

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5" aria-labelledby={id('card-details-title')}>
      <h3 id={id('card-details-title')} className="text-sm font-black uppercase tracking-[0.14em] text-white/55">{t(`${ns}.ui.cards.details_title`)}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={id('cardLanguage')} label={t(`${ns}.ui.cards.language_label`)} optional error={err('cardLanguage')} accent={accent} ns={ns}>
          <select id={id('cardLanguage')} value={form.cardLanguage} onChange={(e) => patch({ cardLanguage: e.target.value })} className={inputCls(!!err('cardLanguage'), accent)}>
            <option value="">{t(`${ns}.ui.cards.language_none`)}</option>
            {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </Field>

        <Field id={id('cardRarity')} label={t(`${ns}.ui.cards.rarity_label`)} optional error={err('cardRarity')} accent={accent} ns={ns}>
          <input
            id={id('cardRarity')}
            type="text"
            list={id('cardRarity-list')}
            maxLength={CARD_RARITY_MAX}
            value={form.cardRarity}
            onChange={(e) => patch({ cardRarity: e.target.value })}
            placeholder={t(`${ns}.ui.cards.rarity_placeholder`)}
            className={inputCls(!!err('cardRarity'), accent)}
          />
          <datalist id={id('cardRarity-list')}>
            {suggestions.map((r) => <option key={r} value={r} />)}
          </datalist>
        </Field>
      </div>

      <FieldGroup id={id('gradingCompany')} label={t(`${ns}.ui.cards.grading_label`)} error={err('gradingCompany')} accent={accent} ns={ns}>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          <ChoiceTile
            compact
            accent={accent}
            label={t(`${ns}.ui.cards.grading_none`)}
            selected={!graded}
            onClick={() => patch({ gradingCompany: '', cardGrade: '' })}
          />
          {GRADING_COMPANIES.map((gid) => (
            <ChoiceTile
              key={gid}
              compact
              accent={accent}
              label={gradingCompanyLabel(gid, t(`${ns}.ui.cards.grading_other`))}
              selected={form.gradingCompany === gid}
              onClick={() => patch({ gradingCompany: gid })}
            />
          ))}
        </div>
      </FieldGroup>

      {graded ? (
        <Field id={id('cardGrade')} label={t(`${ns}.ui.cards.grade_label`)} required error={err('cardGrade')} hint={t(`${ns}.ui.cards.grade_hint`)} accent={accent} ns={ns}>
          <input
            id={id('cardGrade')}
            type="text"
            inputMode="decimal"
            maxLength={CARD_GRADE_MAX}
            value={form.cardGrade}
            onChange={(e) => patch({ cardGrade: e.target.value })}
            placeholder={t(`${ns}.ui.cards.grade_placeholder`)}
            className={inputCls(!!err('cardGrade'), accent)}
          />
        </Field>
      ) : null}
    </section>
  );
}
