import { useEffect } from 'react';

const HREF = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';

/** Loads the pixel font only while the game is open (the marketplace never pays for it). */
export default function useGameFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${HREF}"]`)) return undefined;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);
}
