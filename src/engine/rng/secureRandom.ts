import { getRandomBytes } from "expo-crypto";

/**
 * Cryptographically secure bytes from the OS CSPRNG. Used only to create
 * seeds; game outcomes always come from the seeded HMAC stream instead.
 */
export function secureRandomBytes(length: number): Uint8Array {
  return getRandomBytes(length);
}
