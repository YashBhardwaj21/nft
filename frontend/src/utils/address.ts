/**
 * Normalizes an Ethereum address to lowercase for safe comparisons.
 * Prevents case-mismatch bugs where "0xABCD..." !== "0xabcd..."
 * Accepts undefined (wallet not connected) and returns empty string.
 *
 * @example
 * normalizeAddress(connectedAddress) === normalizeAddress(nft.owner) // safe comparison
 */
export const normalizeAddress = (addr: string | undefined): string =>
    addr?.toLowerCase() ?? '';
