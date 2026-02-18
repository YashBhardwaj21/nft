/**
 * SIWE (Sign-In With Ethereum) Message Parser — EIP-4361
 * ======================================================
 *
 * Parses and reconstructs EIP-4361 messages for signature verification.
 * No external libraries — pure string parsing.
 *
 * EIP-4361 FORMAT:
 *   ${domain} wants you to sign in with your Ethereum account:
 *   ${address}
 *
 *   ${statement}
 *
 *   URI: ${uri}
 *   Version: ${version}
 *   Chain ID: ${chainId}
 *   Nonce: ${nonce}
 *   Issued At: ${issuedAt}
 *   [Expiration Time: ${expirationTime}]
 *   [Not Before: ${notBefore}]
 *   [Request ID: ${requestId}]
 *   [Resources:
 *   - ${resource1}
 *   - ${resource2}]
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SiweMessage {
    domain: string;
    address: string;
    statement?: string;
    uri: string;
    version: string;
    chainId: string;
    nonce: string;
    issuedAt: string;
    expirationTime?: string;
    notBefore?: string;
    requestId?: string;
    resources?: string[];
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Parse an EIP-4361 message string into structured fields.
 *
 * Uses line-by-line parsing rather than a single regex to handle
 * optional fields and multi-line resources safely.
 *
 * @param message - Raw SIWE message string
 * @returns Parsed structured message
 * @throws on missing required fields
 */
export function parseSiweMessage(message: string): SiweMessage {
    // Normalize line endings
    const raw = message.replace(/\r\n/g, '\n');
    const lines = raw.split('\n');

    if (lines.length < 1) {
        throw new Error('SIWE: empty message');
    }

    // Line 1: "${domain} wants you to sign in with your Ethereum account:"
    const headerMatch = lines[0].match(
        /^(.+) wants you to sign in with your Ethereum account:$/
    );
    if (!headerMatch) {
        throw new Error('SIWE: invalid header line');
    }
    const domain = headerMatch[1];

    // Line 2: "${address}"  (0x + 40 hex chars)
    if (lines.length < 2) throw new Error('SIWE: missing address line');
    const addressLine = lines[1].trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addressLine)) {
        throw new Error('SIWE: invalid address format');
    }
    const address = addressLine;

    // Find the field block (lines starting with "URI: ", "Version: ", etc.)
    // Everything between address and field block is the statement.
    let fieldStartIdx = -1;
    for (let i = 2; i < lines.length; i++) {
        if (lines[i].startsWith('URI: ')) {
            fieldStartIdx = i;
            break;
        }
    }

    if (fieldStartIdx === -1) {
        throw new Error('SIWE: missing URI field');
    }

    // Statement: everything between address line and field block,
    // trimmed of leading/trailing blank lines
    let statement: string | undefined;
    const statementLines = lines.slice(2, fieldStartIdx);
    // Remove leading and trailing empty lines
    while (statementLines.length > 0 && statementLines[0].trim() === '') {
        statementLines.shift();
    }
    while (statementLines.length > 0 && statementLines[statementLines.length - 1].trim() === '') {
        statementLines.pop();
    }
    if (statementLines.length > 0) {
        statement = statementLines.join('\n');
    }

    // Parse field block
    const fields: Record<string, string> = {};
    const resources: string[] = [];
    let inResources = false;

    for (let i = fieldStartIdx; i < lines.length; i++) {
        const line = lines[i];

        if (inResources) {
            if (line.startsWith('- ')) {
                resources.push(line.slice(2));
            }
            continue;
        }

        if (line === 'Resources:') {
            inResources = true;
            continue;
        }

        const colonIdx = line.indexOf(': ');
        if (colonIdx > 0) {
            const key = line.substring(0, colonIdx);
            const value = line.substring(colonIdx + 2);
            fields[key] = value;
        }
    }

    // Extract required fields
    const uri = fields['URI'];
    const version = fields['Version'];
    const chainId = fields['Chain ID'];
    const nonce = fields['Nonce'];
    const issuedAt = fields['Issued At'];

    if (!uri) throw new Error('SIWE: missing URI');
    if (!version) throw new Error('SIWE: missing Version');
    if (!chainId) throw new Error('SIWE: missing Chain ID');
    if (!nonce) throw new Error('SIWE: missing Nonce');
    if (!issuedAt) throw new Error('SIWE: missing Issued At');

    return {
        domain,
        address,
        statement,
        uri,
        version,
        chainId,
        nonce,
        issuedAt,
        expirationTime: fields['Expiration Time'],
        notBefore: fields['Not Before'],
        requestId: fields['Request ID'],
        resources: resources.length > 0 ? resources : undefined,
    };
}

// ============================================================================
// CANONICAL RECONSTRUCTION
// ============================================================================

/**
 * Reconstruct the canonical EIP-4361 message from parsed fields.
 *
 * The server verifies the signature against THIS canonical form,
 * not the raw user input. This prevents whitespace/encoding attacks.
 */
export function reconstructCanonicalMessage(parsed: SiweMessage): string {
    let msg = `${parsed.domain} wants you to sign in with your Ethereum account:\n`;
    msg += `${parsed.address}`;

    if (parsed.statement) {
        msg += `\n\n${parsed.statement}`;
    }

    msg += `\n\nURI: ${parsed.uri}`;
    msg += `\nVersion: ${parsed.version}`;
    msg += `\nChain ID: ${parsed.chainId}`;
    msg += `\nNonce: ${parsed.nonce}`;
    msg += `\nIssued At: ${parsed.issuedAt}`;

    if (parsed.expirationTime) {
        msg += `\nExpiration Time: ${parsed.expirationTime}`;
    }
    if (parsed.notBefore) {
        msg += `\nNot Before: ${parsed.notBefore}`;
    }
    if (parsed.requestId) {
        msg += `\nRequest ID: ${parsed.requestId}`;
    }
    if (parsed.resources && parsed.resources.length > 0) {
        msg += `\nResources:`;
        for (const r of parsed.resources) {
            msg += `\n- ${r}`;
        }
    }

    return msg;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate SIWE message constraints.
 *
 * Checks:
 *   - domain is non-empty
 *   - chainId is numeric
 *   - expirationTime is not in the past
 *   - notBefore is not in the future
 *
 * @throws on validation failure
 */
export function validateSiweMessage(
    parsed: SiweMessage,
    expectedDomain?: string,
): void {
    // Domain check
    if (!parsed.domain || parsed.domain.length === 0) {
        throw new Error('SIWE: empty domain');
    }
    if (expectedDomain && parsed.domain !== expectedDomain) {
        throw new Error(`SIWE: domain mismatch — expected ${expectedDomain}, got ${parsed.domain}`);
    }

    // Chain ID must be numeric
    if (!/^\d+$/.test(parsed.chainId)) {
        throw new Error('SIWE: invalid chainId');
    }

    // Version must be "1"
    if (parsed.version !== '1') {
        throw new Error(`SIWE: unsupported version ${parsed.version}`);
    }

    const now = new Date();

    // Expiration check
    if (parsed.expirationTime) {
        const expiry = new Date(parsed.expirationTime);
        if (isNaN(expiry.getTime())) {
            throw new Error('SIWE: invalid expirationTime format');
        }
        if (expiry < now) {
            throw new Error('SIWE: message expired');
        }
    }

    // Not-before check
    if (parsed.notBefore) {
        const notBefore = new Date(parsed.notBefore);
        if (isNaN(notBefore.getTime())) {
            throw new Error('SIWE: invalid notBefore format');
        }
        if (notBefore > now) {
            throw new Error('SIWE: message not yet valid');
        }
    }
}
