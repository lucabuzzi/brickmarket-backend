import { useEffect, useState } from 'react';
import { buildAvatarSheet } from './skinLoader';

/** The recoloured sheet canvas for `avatar` (null while it is being built). */
export default function useAvatarSheet(avatar) {
  const [sheet, setSheet] = useState(null);
  const key = JSON.stringify(avatar);
  useEffect(() => {
    let live = true;
    buildAvatarSheet(JSON.parse(key)).then((c) => { if (live) setSheet(c); }).catch((err) => console.error('Avatar sheet failed:', err));
    return () => { live = false; };
  }, [key]);
  return sheet;
}
