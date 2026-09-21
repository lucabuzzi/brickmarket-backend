/** 0–3 score: length plus character variety. Guidance only — the server enforces its own rules. */
export function passwordScore(pw) {
  if (!pw) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (pw.length >= 12 && variety >= 3) return 3;
  if (pw.length >= 8 && variety >= 2) return 2;
  return 1;
}

export const STRENGTH_LEVELS = [
  null,
  { key: 'weak', color: '#ff5a36' },
  { key: 'medium', color: '#facc15' },
  { key: 'strong', color: '#c6ff3d' },
];
