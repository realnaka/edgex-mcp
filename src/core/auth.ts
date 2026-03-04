import { randomBytes } from 'node:crypto';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { Point } from '@scure/starknet';

// ─── Recursive value serialization (matches Go/Python SDK) ───

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return value.map(v => serializeValue(v)).join('&');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .filter(k => obj[k] !== undefined)
      .map(k => `${k}=${serializeValue(obj[k])}`)
      .join('&');
  }

  return String(value);
}

// ─── Build the sign content string ───

export function buildSignContent(
  timestamp: number,
  method: string,
  path: string,
  params?: Record<string, unknown>,
): string {
  const methodUpper = method.toUpperCase();

  if (!params || Object.keys(params).length === 0) {
    return `${timestamp}${methodUpper}${path}`;
  }

  let paramStr: string;
  if (methodUpper === 'GET') {
    paramStr = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
  } else {
    paramStr = serializeValue(params);
  }

  return `${timestamp}${methodUpper}${path}${paramStr}`;
}

// ─── Sign request using StarkEx ECDSA ───

const EC_ORDER = Point.Fn.ORDER;
const MAX_STARK_VALUE = 1n << 251n;

function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

interface StarkSignature { r: bigint; s: bigint; yPub: bigint }

function starkEcdsaSign(msgHash: bigint, privKey: bigint): StarkSignature {
  const pubPoint = Point.BASE.multiply(privKey);
  const Fn = Point.Fn;

  for (let attempt = 0; attempt < 256; attempt++) {
    const kBig = bytesToBigInt(randomBytes(32)) % EC_ORDER;
    if (kBig === 0n) continue;

    const R = Point.BASE.multiply(kBig);
    const r = R.x;
    if (r === 0n || r >= MAX_STARK_VALUE) continue;

    const sum = (msgHash + (r * privKey) % EC_ORDER) % EC_ORDER;
    if (sum === 0n) continue;

    const w = (kBig * Fn.inv(sum)) % EC_ORDER;
    if (w === 0n || w >= MAX_STARK_VALUE) continue;

    const s = Fn.inv(w);
    return { r, s, yPub: pubPoint.y };
  }

  throw new Error('Failed to generate valid StarkEx ECDSA signature');
}

export function signRequest(
  method: string,
  path: string,
  starkPrivateKey: string,
  params?: Record<string, unknown>,
): { timestamp: string; signature: string } {
  const timestamp = Date.now();
  const signContent = buildSignContent(timestamp, method, path, params);

  const hashBytes = keccak_256(new TextEncoder().encode(signContent));
  const msgHash = bytesToBigInt(hashBytes) % EC_ORDER;

  const privKeyRaw = starkPrivateKey.startsWith('0x') ? starkPrivateKey.slice(2) : starkPrivateKey;
  const privKeyBig = BigInt('0x' + privKeyRaw);

  const { r, s, yPub } = starkEcdsaSign(msgHash, privKeyBig);

  const rHex = r.toString(16).padStart(64, '0');
  const sHex = s.toString(16).padStart(64, '0');
  const yHex = yPub.toString(16).padStart(64, '0');

  return {
    timestamp: String(timestamp),
    signature: rHex + sHex + yHex,
  };
}
