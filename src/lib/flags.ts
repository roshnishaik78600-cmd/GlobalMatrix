/**
 * Flags, for the places that have one.
 *
 * A flag is an identifier, not a data claim: it says which country a card is
 * about, nothing about that country's politics or condition. It is therefore
 * only ever returned for a node whose id is a real ISO-3166 alpha-2 code, and
 * `null` for everything else — the European Union, the Strait of Hormuz, the
 * cross-border settlement rail. A flag beside a chokepoint would be a small lie
 * about what the node is, and the whole product is built on not doing that.
 *
 * The list is deliberately explicit rather than a computed lookup: an unknown id
 * returning a glyph is exactly the failure this module exists to prevent.
 */

/** Only the alpha-2 codes the transmission graph actually contains. */
const FLAGS: Record<string, string> = {
  CN: "🇨🇳",
  US: "🇺🇸",
  RU: "🇷🇺",
  IR: "🇮🇷",
  TW: "🇹🇼",
  KR: "🇰🇷",
  JP: "🇯🇵",
  NL: "🇳🇱",
  GB: "🇬🇧",
  DE: "🇩🇪",
  IN: "🇮🇳",
  TR: "🇹🇷",
  AE: "🇦🇪",
  SA: "🇸🇦",
  SG: "🇸🇬",
  BR: "🇧🇷",
  ZA: "🇿🇦",
  MY: "🇲🇾",
};

/**
 * The flag for a node id, or `null` when the node is not a sovereign economy.
 * `EU` is absent on purpose: it is a bloc, and no flag represents one.
 */
export function flagFor(nodeId: string): string | null {
  return FLAGS[nodeId] ?? null;
}

/** True when this node is an economy with a flag of its own. */
export function hasFlag(nodeId: string): boolean {
  return flagFor(nodeId) !== null;
}