/**
 * Security Utilities for Dot Color Communication ERP/POS
 * Implements SEC-04: Client-side cryptographic hashing for staff PINs / passcodes
 * with non-destructive, backward-compatible auto-upgrade for legacy plain-text PINs.
 */

const PIN_SALT = 'dotcolor_salt_v1:';
const HASH_PREFIX = 'sha256:';

/**
 * Pure JavaScript SHA-256 implementation
 * Works synchronously in any browser, Node.js, or worker environment without external dependencies.
 */
function rawSha256(ascii: string): string {
    function rightRotate(value: number, amount: number) {
        return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let lengthProperty = 'length';
    let i = 0;
    let j = 0;
    let result = '';
    const words: number[] = [];
    const asciiBitLength = ascii.length * 8;
    let hash: number[] = [];
    const k: number[] = [];
    let primeCounter = 0;
    const isComposite: Record<number, boolean> = {};

    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (i = candidate * candidate; i < 312; i += candidate) {
                isComposite[i] = true;
            }
            hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
    }

    hash = hash.slice(0, 8);
    ascii += '\x80';
    while ((ascii.length % 64) - 56) ascii += '\x00';

    for (i = 0; i < ascii.length; i++) {
        j = ascii.charCodeAt(i);
        words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }

    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;

    for (j = 0; j < words.length;) {
        const w = words.slice(j, (j += 16));
        const oldHash = hash;
        hash = hash.slice(0, 8);
        for (i = 0; i < 64; i++) {
            const w15 = w[i - 15] || 0;
            const w2 = w[i - 2] || 0;
            const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
            const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
            const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
            const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
            const s0_h0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
            const s1_h4 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
            const t1 = (hash[7] + s1_h4 + ch + k[i] + (w[i] = i < 16 ? (w[i] || 0) : ((w[i - 16] || 0) + s0 + (w[i - 7] || 0) + s1) | 0)) | 0;
            const t2 = (s0_h0 + maj) | 0;
            hash = [(t1 + t2) | 0, hash[0], hash[1], hash[2], (hash[3] + t1) | 0, hash[4], hash[5], hash[6]];
        }
        for (i = 0; i < 8; i++) {
            hash[i] = (hash[i] + oldHash[i]) | 0;
        }
    }

    for (i = 0; i < 8; i++) {
        for (j = 3; j >= 0; j--) {
            const b = (hash[i] >> (j * 8)) & 255;
            result += (b < 16 ? '0' : '') + b.toString(16);
        }
    }

    return result;
}

/**
 * Checks whether a given string is already a hashed PIN (sha256:...)
 */
export function isPinHashed(pinOrHash?: string): boolean {
    if (!pinOrHash) return false;
    return typeof pinOrHash === 'string' && pinOrHash.startsWith(HASH_PREFIX);
}

/**
 * Hashes a staff PIN using salted SHA-256
 */
export function hashPin(pin: string): string {
    const trimmed = (pin || '').trim();
    if (!trimmed) return '';
    if (isPinHashed(trimmed)) return trimmed;
    const digest = rawSha256(PIN_SALT + trimmed);
    return `${HASH_PREFIX}${digest}`;
}

/**
 * Verifies an entered PIN against a stored PIN or stored hash.
 * Returns:
 *   valid: boolean (whether the PIN matches)
 *   needsUpgrade: boolean (true if the stored PIN was legacy plain-text and matched)
 *   upgradedHash: string (the newly hashed PIN ready to be persisted)
 */
export function verifyPin(
    enteredPin: string,
    storedPinOrHash?: string
): { valid: boolean; needsUpgrade: boolean; upgradedHash: string } {
    const trimmedInput = (enteredPin || '').trim();
    const stored = (storedPinOrHash || '').trim();

    if (!trimmedInput) {
        return { valid: false, needsUpgrade: false, upgradedHash: '' };
    }

    // Default fallback PIN is '1234' if none set
    const effectiveStored = stored || '1234';

    if (isPinHashed(effectiveStored)) {
        const expectedHash = hashPin(trimmedInput);
        const valid = expectedHash.toLowerCase() === effectiveStored.toLowerCase();
        return { valid, needsUpgrade: false, upgradedHash: effectiveStored };
    }

    // Legacy plain-text comparison
    if (trimmedInput === effectiveStored) {
        // Matched! Generate upgrade hash
        const upgradedHash = hashPin(trimmedInput);
        return { valid: true, needsUpgrade: true, upgradedHash };
    }

    return { valid: false, needsUpgrade: false, upgradedHash: '' };
}

/**
 * Masks a PIN for safe display in UI tables/lists
 */
export function maskPin(pinOrHash?: string): string {
    if (!pinOrHash) return '••••';
    return '••••••';
}
