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
export default function CardDetails({ form, patch, err }) {
  const { t, i18n } = useTranslation();
  const languages = useMemo(
    () => CARD_LANGUAGES.map((code) => ({ code, name: languageName(code, i18n.language) })).sort((a, b) => a.name.localeCompare(b.name, i18n.language)),
    [i18n.language],
  );
  const suggestions = raritySuggestions(form.game);
  const graded = !!form.gradingCompany;

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5" aria-labelledby="sell-card-details-title">
      <h3 id="sell-card-details-title" className="text-sm font-black uppercase tracking-[0.14em] text-white/55">{t('sell.ui.cards.details_title')}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="sell-cardLanguage" label={t('sell.ui.cards.language_label')} optional error={err('cardLanguage')}>
          <select id="sell-cardLanguage" value={form.cardLanguage} onChange={(e) => patch({ cardLanguage: e.target.value })} className={inputCls(!!err('cardLanguage'))}>
            <option value="">{t('sell.ui.cards.language_none')}</option>
            {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </Field>

        <Field id="sell-cardRarity" label={t('sell.ui.cards.rarity_label')} optional error={err('cardRarity')}>
          <input
            id="sell-cardRarity"
            type="text"
            list="sell-cardRarity-list"
            maxLength={CARD_RARITY_MAX}
            value={form.cardRarity}
            onChange={(e) => patch({ cardRarity: e.target.value })}
            placeholder={t('sell.ui.cards.rarity_placeholder')}
            className={inputCls(!!err('cardRarity'))}
          />
          <datalist id="sell-cardRarity-list">
            {suggestions.map((r) => <option key={r} value={r} />)}
          </datalist>
        </Field>
      </div>

      <FieldGroup id="sell-gradingCompany" label={t('sell.ui.cards.grading_label')} error={err('gradingCompany')}>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          <ChoiceTile
            compact
            label={t('sell.ui.cards.grading_none')}
            selected={!graded}
            onClick={() => patch({ gradingCompany: '', cardGrade: '' })}
          />
          {GRADING_COMPANIES.map((id) => (
            <ChoiceTile
              key={id}
              compact
              label={gradingCompanyLabel(id, t('sell.ui.cards.grading_other'))}
              selected={form.gradingCompany === id}
              onClick={() => patch({ gradingCompany: id })}
            />
          ))}
        </div>
      </FieldGroup>

      {graded ? (
        <Field id="sell-cardGrade" label={t('sell.ui.cards.grade_label')} required error={err('cardGrade')} hint={t('sell.ui.cards.grade_hint')}>
          <input
            id="sell-cardGrade"
            type="text"
            inputMode="decimal"
            maxLength={CARD_GRADE_MAX}
            value={form.cardGrade}
            onChange={(e) => patch({ cardGrade: e.target.value })}
            placeholder={t('sell.ui.cards.grade_placeholder')}
            className={inputCls(!!err('cardGrade'))}
          />
        </Field>
      ) : null}
    </section>
  );
}
