import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { sanitizeAvatar } from '../lib/game/skins';
import useGameFont from './useGameFont';
import TitleScreen from './screens/TitleScreen';
import { AccessMenu, LoginScreen } from './screens/AccessScreen';
import RegisterScreen from './screens/RegisterScreen';
import CreatorScreen from './screens/CreatorScreen';
import WorldScreen from './screens/WorldScreen';
import './game.css';

const AUTH_PHASES = ['access', 'login', 'register'];

/**
 * "CardBrix the game!" - a full-screen experience that lives on its own route (/game), outside the site's
 * Layout. It shares only the account (same login, same wallet) with the marketplace: nothing of the game
 * is embedded in the site, apart from the link on the home page.
 */
export default function GamePage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const location = useLocation();
  // Coming back from a page of the game (e.g. a player's inventory) skips the title screen: 'access' turns into
  // the world (or the creator) as soon as the signed-in user is known.
  const [rawPhase, setPhase] = useState(() => (location.state?.resume ? 'access' : 'title')); // title | access | login | register | creator | world
  const [editing, setEditing] = useState(false);
  useGameFont();

  // metadata for this page only: it is a game screen, not a page to index
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'CardBrix the game!';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => { document.title = prevTitle; robots.remove(); };
  }, []);

  const avatarKey = user?.avatar_config ? JSON.stringify(sanitizeAvatar(user.avatar_config)) : '';
  // referentially stable per saved value so the scene restarts only when the character really changes
  const stableAvatar = useMemo(() => (avatarKey ? JSON.parse(avatarKey) : null), [avatarKey]);

  // Signing in or registering (from the game) lands the player in the world, or in the creator when the
  // account has no character yet (accounts created on the site). Derived, so there is no extra render.
  const phase = user && AUTH_PHASES.includes(rawPhase) ? (stableAvatar ? 'world' : 'creator') : rawPhase;

  function start() {
    if (loading) return;
    if (!user) setPhase('access');
    else setPhase(stableAvatar ? 'world' : 'creator');
  }

  let screen;
  if (phase === 'title') screen = <TitleScreen onStart={start} busy={loading} />;
  else if (phase === 'access') screen = <AccessMenu onNew={() => setPhase('register')} onLogin={() => setPhase('login')} />;
  else if (phase === 'login') screen = <LoginScreen onBack={() => setPhase('access')} />;
  else if (phase === 'register') screen = <RegisterScreen onBack={() => setPhase('access')} />;
  else if (phase === 'creator' || editing) {
    screen = (
      <CreatorScreen
        initial={stableAvatar}
        onDone={() => { setEditing(false); setPhase('world'); }}
        onCancel={stableAvatar ? () => setEditing(false) : null}
      />
    );
  } else if (stableAvatar) screen = <WorldScreen avatar={stableAvatar} onEdit={() => setEditing(true)} />;
  else screen = <CreatorScreen initial={null} onDone={() => setPhase('world')} />;

  return (
    <div className="cbg-root">
      <Link to="/" className="cbg-pixel fixed left-3 top-3 z-50 inline-flex min-h-11 items-center gap-2 border-4 border-black bg-[#1d1930] px-3 text-[0.6rem] uppercase text-white transition hover:brightness-125">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('game.back_to_site')}
      </Link>
      {screen}
    </div>
  );
}
