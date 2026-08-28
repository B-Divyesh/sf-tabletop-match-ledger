const SLUG = 'tabletop-match-ledger';
const TOKEN_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `${TOKEN_KEY}:verdict`;
const DAY = 86_400_000;

export type LicenseState = { unlocked: boolean; checking: boolean; notice?: string };

type Verdict = { valid: boolean; checkedAt: number };

export function captureLicense(): void {
  const url = new URL(location.href);
  const token = url.searchParams.get('license');
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(VERDICT_KEY);
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function cachedLicenseState(): LicenseState {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { unlocked: false, checking: false };
  try {
    const verdict = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? '') as Verdict;
    return { unlocked: verdict.valid, checking: Date.now() - verdict.checkedAt >= DAY };
  } catch {
    return { unlocked: true, checking: true };
  }
}

export async function verifyLicense(force = false): Promise<LicenseState> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { unlocked: false, checking: false };
  const cached = cachedLicenseState();
  if (!force && !cached.checking) return cached;
  try {
    const response = await fetch(`https://api.sociobot.in/api/v1/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verification unavailable');
    const result = await response.json() as { valid: boolean };
    localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: result.valid, checkedAt: Date.now() }));
    return result.valid ? { unlocked: true, checking: false } : { unlocked: false, checking: false, notice: 'This license is no longer active.' };
  } catch {
    return { ...cached, checking: false, notice: 'License check will retry when you are online.' };
  }
}

export function storeLicense(token: string): void {
  if (!token.trim()) throw new Error('Paste the license token from your receipt.');
  localStorage.setItem(TOKEN_KEY, token.trim());
  localStorage.removeItem(VERDICT_KEY);
}

export const checkoutUrl = `https://api.sociobot.in/api/v1/products/${SLUG}/checkout`;
