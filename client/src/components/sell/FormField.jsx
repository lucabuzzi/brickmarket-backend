import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function Label({ htmlFor, id, as: Tag = 'label', label, required, optional }) {
  const { t } = useTranslation();
  return (
    <Tag id={id} htmlFor={Tag === 'label' ? htmlFor : undefined} className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-white/80">
      {label}
      {required ? (
        <>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#c6ff3d]" />
          <span className="sr-only">{t('sell.ui.required')}</span>
        </>
      ) : optional ? (
        <span className="text-[11px] font-medium text-white/35">{t('sell.ui.optional')}</span>
      ) : null}
    </Tag>
  );
}

function Message({ id, error, hint }) {
  if (error) {
    return (
      <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-red-300">
        <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </p>
    );
  }
  return hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs text-white/45">{hint}</p> : null;
}

/** Label + control + hint/error for a single input. `id` must be the id of the control inside. */
export default function Field({ id, label, required = false, optional = false, error, hint, className = '', children }) {
  return (
    <div className={className}>
      <Label htmlFor={id} label={label} required={required} optional={optional} />
      {children}
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}

/** Same, for a group of choices (tiles, switches): the label names the group instead of one input. */
export function FieldGroup({ id, label, required = false, optional = false, error, hint, className = '', role = 'radiogroup', children }) {
  return (
    <div className={className}>
      <Label id={`${id}-label`} as="span" label={label} required={required} optional={optional} />
      <div id={id} role={role} aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-err` : undefined} aria-invalid={error ? true : undefined}>
        {children}
      </div>
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}
