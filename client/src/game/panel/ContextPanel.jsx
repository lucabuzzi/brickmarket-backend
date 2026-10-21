import { useTranslation } from 'react-i18next';
import { ChevronLeft, X } from 'lucide-react';
import AvatarPreview from '../components/AvatarPreview';
import DragonView from '../components/DragonView';
import { npcById, npcNameKey, npcRoleKey } from '../../lib/game/npcs';
import { currentView, canGoBack } from '../../lib/game/contextPanel';
import DialogView from './DialogView';
import { GoodsView, ProductView, AuctionsView, ArenaView, PlayerView } from './Views';

const DEFAULT_COLOR = '#c6ff3d';

/** Pixel portrait of the NPC (or the player) the panel is talking about. */
function Portrait({ npc, avatar, color }) {
  return (
    <span className="cbg-portrait" style={{ borderColor: color }}>
      {npc?.portrait === 'dragon' ? <DragonView scale={1} /> : <AvatarPreview avatar={npc ? npc.avatar : avatar} scale={1} />}
    </span>
  );
}

/**
 * The side panel of the game, in RPG style: what it shows depends on what the player interacts with (see
 * lib/game/contextPanel.js). `panel` is the reducer state, `dispatch` its dispatcher; `onChoose(npc, node, option)`
 * runs a dialogue answer; `emptyHint` is shown when nothing is selected (only in the fixed desktop column).
 */
export default function ContextPanel({ panel, dispatch, onChoose, emptyHint, className = '' }) {
  const { t } = useTranslation();
  const view = currentView(panel);

  if (!view) {
    return (
      <aside className={`cbg-panel flex min-h-0 flex-col ${className}`} aria-label={t('game.panel.label')}>
        <div className="flex flex-1 items-center justify-center p-5 text-center text-sm leading-relaxed text-white/55">{emptyHint}</div>
      </aside>
    );
  }

  const npc = view.npc ? npcById(view.npc) : null;
  const color = npc?.color || DEFAULT_COLOR;
  const name = npc ? t(npcNameKey(npc.id)) : view.kind === 'player' ? view.player.u : '';
  const role = npc ? t(npcRoleKey(npc.id)) : t('game.inventory.kicker');
  const pick = (item) => dispatch({ type: 'push', view: { kind: 'product', item, npc: view.npc || null } });

  let body = null;
  if (view.kind === 'dialog') body = <DialogView key={`${view.npc}:${view.node}`} npc={view.npc} node={view.node} onChoose={(o) => onChoose(view.npc, view.node, o)} />;
  else if (view.kind === 'goods') body = <GoodsView query={view.query} color={color} onPick={pick} />;
  else if (view.kind === 'product') body = <ProductView item={view.item} color={color} />;
  else if (view.kind === 'auctions') body = <AuctionsView color={color} onPick={pick} />;
  else if (view.kind === 'arena') body = <ArenaView color={color} />;
  else if (view.kind === 'player') body = <PlayerView username={view.player.u} onPick={pick} />;

  return (
    <aside className={`cbg-panel cbg-context flex min-h-0 flex-col ${className}`} style={{ borderColor: color }} aria-label={name || t('game.panel.label')}>
      <header className="flex shrink-0 items-center gap-2 border-b-2 border-black/60 p-2">
        {canGoBack(panel) ? (
          <button type="button" onClick={() => dispatch({ type: 'back' })} aria-label={t('game.panel.back')} className="cbg-icon-btn">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <Portrait npc={npc} avatar={view.player?.a} color={color} />
        <div className="min-w-0 flex-1">
          <p className="cbg-pixel truncate text-[0.6rem] uppercase" style={{ color }}>{name}</p>
          <p className="mt-1 truncate text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/50">{role}</p>
        </div>
        <button type="button" onClick={() => dispatch({ type: 'close' })} aria-label={t('game.plaza.close')} className="cbg-icon-btn">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
    </aside>
  );
}
