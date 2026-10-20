import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { apiPostForm } from '../../api';
import AvatarCreator from '../components/AvatarCreator';
import { randomAvatar, sanitizeAvatar } from '../../lib/game/skins';

/** Character creator for someone who is already signed in (first visit, or "edit character"). */
export default function CreatorScreen({ initial, onDone, onCancel }) {
  const { t } = useTranslation();
  const { refreshMe } = useAuth();
  const [avatar, setAvatar] = useState(() => (initial ? sanitizeAvatar(initial) : randomAvatar()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('avatarConfig', JSON.stringify(avatar));
      await apiPostForm('/api/auth/me', fd, { method: 'PATCH' });
      await refreshMe();
      onDone();
    } catch (err) {
      setError(err?.data?.error || t('game.creator.save_error'));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-24">
      <div className="cbg-panel w-full max-w-3xl p-5 sm:p-8">
        <h2 className="cbg-pixel text-base uppercase text-white sm:text-lg">{t('game.creator.title')}</h2>
        <p className="mb-6 mt-3 text-sm text-white/60">{initial ? t('game.creator.edit_hint') : t('game.creator.first_hint')}</p>
        <AvatarCreator value={avatar} onChange={setAvatar} />
        {error && <p className="mt-4 text-sm font-bold text-[#ff7a5c]" role="alert">{error}</p>}
        <div className="mt-8 flex flex-wrap gap-4">
          <button type="button" className="cbg-btn" onClick={save} disabled={busy}>{busy ? t('game.creator.saving') : t('game.creator.save')}</button>
          {onCancel && <button type="button" className="cbg-btn cbg-btn--ghost" onClick={onCancel}>{t('game.creator.cancel')}</button>}
        </div>
      </div>
    </div>
  );
}
