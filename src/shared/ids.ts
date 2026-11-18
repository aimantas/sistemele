const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/**
 * Sortable, prefixed identifiers: `ct_01jdq8w3k9x7v2m4n6p8r0s2t4`.
 * 10 time characters (ms) + 16 random characters (80 bits).
 * Prefix examples: usr, ct (contact), dl (deal), act, prd, mv, qt, inv.
 */
export function newId(prefix: string): string {
  let time = Date.now();
  let timePart = "";
  for (let i = 0; i < 10; i++) {
    timePart = ALPHABET[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let randomPart = "";
  for (const byte of bytes) randomPart += ALPHABET[byte % 32];
  return `${prefix}_${timePart}${randomPart}`;
}
