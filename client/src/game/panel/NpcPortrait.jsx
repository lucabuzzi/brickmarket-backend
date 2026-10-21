import AvatarPreview from '../components/AvatarPreview';
import DragonView from '../components/DragonView';

/** Pixel portrait of an NPC (or, without `npc`, of a player's `avatar`) in a frame of `color`. */
export default function NpcPortrait({ npc, avatar, color }) {
  return (
    <span className="cbg-portrait" style={{ borderColor: color }}>
      {npc?.portrait === 'dragon' ? <DragonView scale={1} /> : <AvatarPreview avatar={npc ? npc.avatar : avatar} scale={1} />}
    </span>
  );
}
