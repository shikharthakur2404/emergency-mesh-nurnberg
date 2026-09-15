/**
 * Emergency Mesh Nürnberg — Anti-Spam Proof-of-Work (PoW) Engine
 * Implements Hashcash SHA-256 client puzzle to throttle automated beacon floods
 * without requiring centralized registration or cloud access.
 */

import CryptoJS from 'crypto-js';

// Default difficulty: 12 bits (3 hex zeros: 0x000...)
// Average ~4,096 iterations (~50-200ms on mobile CPU).
// Throttles automated flood scripts from transmitting thousands of false beacons per second.
export const DEFAULT_POW_DIFFICULTY = 12;

/**
 * Verifies if a given nonce solves the Proof-of-Work challenge for the canonical payload.
 */
export function verifyProofOfWork(
  canonicalPayload: string,
  nonce?: number,
  difficultyBits = DEFAULT_POW_DIFFICULTY
): boolean {
  if (nonce === undefined || nonce === null || typeof nonce !== 'number' || isNaN(nonce)) {
    return false;
  }

  const input = `${canonicalPayload}:pow:${nonce}`;
  const hash = CryptoJS.SHA256(input).toString();

  const fullHexZeros = Math.floor(difficultyBits / 4);
  const remainingBits = difficultyBits % 4;

  // Check full 4-bit nibbles
  if (!hash.startsWith('0'.repeat(fullHexZeros))) {
    return false;
  }

  // Check remaining bits in next nibble if any
  if (remainingBits > 0) {
    const nextHexVal = parseInt(hash[fullHexZeros], 16);
    const maxAllowed = (1 << (4 - remainingBits)) - 1;
    if (nextHexVal > maxAllowed) {
      return false;
    }
  }

  return true;
}

/**
 * Solves the Proof-of-Work challenge for a public emergency payload.
 */
export function solveProofOfWork(
  canonicalPayload: string,
  difficultyBits = DEFAULT_POW_DIFFICULTY,
  maxIterations = 200000
): number {
  for (let nonce = 0; nonce < maxIterations; nonce++) {
    if (verifyProofOfWork(canonicalPayload, nonce, difficultyBits)) {
      return nonce;
    }
  }
  return 0;
}
