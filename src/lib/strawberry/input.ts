export function normalizeInput(word: unknown, letter: unknown) {
  if (typeof word !== "string" || typeof letter !== "string") return null;
  const w = word.trim().toLowerCase(), l = letter.trim().toLowerCase();
  return /^[a-z]{1,24}$/.test(w) && /^[a-z]$/.test(l) ? { word: w, letter: l } : null;
}
