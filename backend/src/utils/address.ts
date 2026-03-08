/**
 * Normalizes an Ethereum address to lowercase for safe comparisons.
 * Prevents case-mismatch bugs where "0xABCD..." !== "0xabcd..."
 *
 * @example
 * normalizeAddress("0xABCD...") === normalizeAddress("0xabcd...") // true
 */
export const normalizeAddress = (addr: string): string =>
    addr?.toLowerCase() ?? '';
