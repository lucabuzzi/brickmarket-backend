import dragonStatue from '../../assets/game/dragon-statue.png';

/**
 * The dragon of the plaza (artwork built by scripts/build-game-dragon.js), as an image `width` px wide: the title
 * screen and the tutorial victory card show the same dragon the player meets in the game.
 */
export default function DragonStatue({ width = 240, className = '' }) {
  return (
    <img
      src={dragonStatue}
      alt=""
      aria-hidden
      width={width}
      height={Math.round((width * 260) / 311)}
      decoding="async"
      className={className}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}
