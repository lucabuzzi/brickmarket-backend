import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import legalPages from '../config/legalPages.json';
import NotFound from './NotFound';

// Which flag in config/legalPages.json publishes each policy; while it is off the page answers "not found".
const PUBLISHED_FLAG = { privacy: 'published', cookie_policy: 'published', accessibility: 'accessibilityPublished' };

// Renders a policy whose text lives in the locale files as `${ns}.title`, `${ns}.subtitle` and numbered
// `${ns}.sN_title` / `${ns}.sN_body` pairs (privacy, cookie_policy). Lines starting with "• " become a list.
export default function PolicyPage({ ns }) {
  const { t, i18n } = useTranslation();
  const published = Boolean(legalPages[PUBLISHED_FLAG[ns]]);

  if (!published) return <NotFound />;

  const sections = [];
  for (let n = 1; i18n.exists(`${ns}.s${n}_title`); n += 1) sections.push(n);

  const renderBody = (text) => {
    const blocks = [];
    let bullets = [];
    const flush = () => {
      if (bullets.length) blocks.push({ list: bullets });
      bullets = [];
    };
    text.split('\n').forEach((line) => {
      if (line.startsWith('• ')) bullets.push(line.slice(2));
      else {
        flush();
        if (line.trim()) blocks.push({ text: line });
      }
    });
    flush();
    return blocks.map((b, i) => (b.list ? (
      <ul key={i} className="my-3 list-disc space-y-2 pl-5 marker:text-white/30">
        {b.list.map((item, j) => <li key={j}>{item}</li>)}
      </ul>
    ) : (
      <p key={i} className="my-3">{b.text}</p>
    )));
  };

  return (
    <div className="page mx-auto max-w-[850px] px-4 py-8 text-[var(--text)] md:px-6 md:py-12">
      <header className="mb-8 text-center md:mb-12">
        <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">{t(`${ns}.title`)}</h1>
        <p className="text-base text-[var(--muted)] md:text-lg">{t(`${ns}.subtitle`)}</p>
      </header>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 leading-relaxed md:p-10">
        {sections.map((n) => (
          <section key={n} className="mb-8 last:mb-0 md:mb-10">
            <h2 className="mb-3 border-b border-[var(--border)] pb-2 text-xl font-bold text-white md:text-2xl">
              {t(`${ns}.s${n}_title`)}
            </h2>
            <div className="break-words text-[var(--muted)]">{renderBody(t(`${ns}.s${n}_body`))}</div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link to="/" className="btn btn--primary inline-block rounded-xl px-8 py-3 text-base font-bold no-underline">
          {t('ui.back_to_home')}
        </Link>
      </div>
    </div>
  );
}
