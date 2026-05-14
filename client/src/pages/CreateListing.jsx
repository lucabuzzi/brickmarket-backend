import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LISTING_ENDPOINTS, apiPostForm } from '../api';

/** Allineato a src/db/schema.sql → listings.type CHECK: used | sealed | moc | auction */
export const LISTING_TYPE = {
  USED: 'used',
  SEALED: 'sealed',
  MOC: 'moc',
  AUCTION: 'auction',
};

const CATEGORIES = [
  { value: '', label: '— Seleziona categoria —' },
  { value: 'Star Wars', label: 'Star Wars' },
  { value: 'City', label: 'City' },
  { value: 'Disney', label: 'Disney' },
  { value: 'Ideas', label: 'Ideas' },
  { value: 'Technic', label: 'Technic' },
  { value: 'Harry Potter', label: 'Harry Potter' },
  { value: 'Marvel', label: 'Marvel' },
  { value: 'Creator', label: 'Creator' },
  { value: 'Speed Champions', label: 'Speed Champions' },
  { value: 'Altro', label: 'Altro' },
];

/** UI: new | used | complete → backend type + condition (colonna `theme` = categoria) */
function mapUiCondition(ui) {
  if (ui === 'new') return { type: LISTING_TYPE.SEALED, condition: 'complete' };
  if (ui === 'used') return { type: LISTING_TYPE.USED, condition: 'good' };
  if (ui === 'complete') return { type: LISTING_TYPE.USED, condition: 'complete' };
  return { type: LISTING_TYPE.USED, condition: null };
}

function appendListingFields(fd, { mode, title, description, priceStr, category, uiCondition }) {
  const { type, condition } = mapUiCondition(uiCondition);

  fd.append('title', title.trim());
  if (description.trim()) fd.append('description', description.trim());
  if (category) fd.append('theme', category);

  fd.append('type', type);
  if (condition) fd.append('condition', condition);

  fd.append('shippingCost', '0');
  fd.append('status', mode === 'draft' ? 'draft' : 'active');

  if (mode === 'publish') {
    fd.append('price', priceStr);
  } else if (priceStr) {
    fd.append('price', priceStr);
  }
}

export default function CreateListing() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [uiCondition, setUiCondition] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  function onFilesChange(e) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list.slice(0, 10));
  }

  function removeFileAt(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(mode) {
    setError('');
    setToast(null);

    const t = title.trim();
    if (mode === 'draft') {
      if (t.length < 1) {
        setError('Il titolo è obbligatorio per salvare la bozza.');
        return;
      }
    } else {
      if (t.length < 5) {
        setError('Il titolo deve avere almeno 5 caratteri per pubblicare.');
        return;
      }
      if (!uiCondition) {
        setError('Seleziona la condizione (Nuovo / Usato / Completo) per pubblicare.');
        return;
      }
      const p = parseFloat(String(price).replace(',', '.'));
      if (!Number.isFinite(p) || p <= 0) {
        setError('Inserisci un prezzo valido per pubblicare.');
        return;
      }
      if (files.length === 0) {
        setError('Carica almeno un\'immagine per pubblicare.');
        return;
      }
    }

    const priceStr =
      mode === 'publish'
        ? String(parseFloat(String(price).replace(',', '.')))
        : price.trim()
          ? String(parseFloat(String(price).replace(',', '.')))
          : '';

    if (mode === 'draft' && priceStr && (!Number.isFinite(parseFloat(priceStr)) || parseFloat(priceStr) <= 0)) {
      setError('Prezzo non valido.');
      return;
    }

    const fd = new FormData();
    appendListingFields(fd, {
      mode,
      title: t,
      description,
      priceStr,
      category,
      uiCondition,
    });
    files.forEach((f) => fd.append('images', f));

    setBusy(true);
    try {
      await apiPostForm(LISTING_ENDPOINTS.create, fd);
      setToast(mode === 'draft' ? 'Bozza salvata.' : 'Annuncio pubblicato.');
      setTimeout(() => navigate('/my-listings', { replace: true }), 900);
    } catch (e) {
      setError(e.message || 'Operazione non riuscita');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Nuovo annuncio</h1>
        <Link
          to="/my-listings"
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          I miei annunci
        </Link>
      </div>

      {toast && (
        <div
          className="mb-4 rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-4 py-3 text-emerald-200"
          role="status"
        >
          {toast}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-700/50 bg-red-950/40 px-4 py-3 text-red-200">{error}</div>
      )}

      <form
        className="space-y-5 rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 shadow-xl backdrop-blur"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Titolo</label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={1}
            maxLength={300}
            placeholder="es. Millennium Falcon UCS"
          />
          <p className="mt-1 text-xs text-slate-500">Bozza: minimo 1 carattere. Pubblica: minimo 5.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Descrizione</label>
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            placeholder="Dettagli, difetti, completezza…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Prezzo (EUR)</label>
            <input
              type="text"
              inputMode="decimal"
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="es. 149.99"
            />
            <p className="mt-1 text-xs text-slate-500">Obbligatorio solo per Pubblica.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Categoria</label>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value === '' ? '_none' : c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Inviata al backend come `theme`.</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Condizione</label>
          <select
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
            value={uiCondition}
            onChange={(e) => setUiCondition(e.target.value)}
          >
            <option value="">— Opzionale in bozza —</option>
            <option value="new">Nuovo (sigillato)</option>
            <option value="used">Usato</option>
            <option value="complete">Completo (usato, tutto presente)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Mappatura: Nuovo → type <code className="text-slate-400">sealed</code>, Usato →{' '}
            <code className="text-slate-400">used</code> + good, Completo → <code className="text-slate-400">used</code>{' '}
            + complete.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Immagini</label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-white hover:file:bg-emerald-500"
            onChange={onFilesChange}
          />
          <p className="mt-1 text-xs text-slate-500">Obbligatorio almeno un file per Pubblica (upload Cloudinary).</p>
          {previews.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-3">
              {previews.map((p, i) => (
                <li key={p.url} className="relative">
                  <img
                    src={p.url}
                    alt=""
                    className="h-24 w-24 rounded-lg border border-slate-600 object-cover"
                  />
                  <button
                    type="button"
                    className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white shadow"
                    onClick={() => removeFileAt(i)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit('draft')}
            className="rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Salva bozza
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit('publish')}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
          >
            Pubblica
          </button>
        </div>
      </form>
    </div>
  );
}
