import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { ContractMeta, CoinMeta } from './types.js';
import { ensureConfigDir, getContractsCacheFile } from './config.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheData {
  timestamp: number;
  contracts: ContractMeta[];
  coins?: CoinMeta[];
}

let memoryContracts: ContractMeta[] | null = null;
let memoryCoins: CoinMeta[] | null = null;

export async function loadCachedContracts(): Promise<ContractMeta[] | null> {
  if (memoryContracts) return memoryContracts;

  const cacheFile = getContractsCacheFile();
  if (!existsSync(cacheFile)) return null;

  try {
    const raw = await readFile(cacheFile, 'utf-8');
    const data: CacheData = JSON.parse(raw);
    if (Date.now() - data.timestamp < CACHE_TTL_MS) {
      memoryContracts = data.contracts;
      memoryCoins = data.coins ?? null;
      return data.contracts;
    }
  } catch {
    // Corrupt cache
  }
  return null;
}

export async function saveCachedContracts(contracts: ContractMeta[], coins?: CoinMeta[]): Promise<void> {
  await ensureConfigDir();
  const cacheFile = getContractsCacheFile();
  const data: CacheData = { timestamp: Date.now(), contracts, coins };
  await writeFile(cacheFile, JSON.stringify(data), 'utf-8');
  memoryContracts = contracts;
  if (coins) memoryCoins = coins;
}

export function getCachedCoins(): CoinMeta[] | null {
  return memoryCoins;
}

export function resolveSymbol(contracts: ContractMeta[], input: string): ContractMeta | null {
  const normalized = input.toUpperCase().trim();

  const exact = contracts.find(c => c.contractName === normalized);
  if (exact) return exact;

  for (const suffix of ['USD', 'USDT', 'USDC']) {
    if (!normalized.endsWith(suffix)) {
      const withSuffix = normalized + suffix;
      const match = contracts.find(c => c.contractName === withSuffix);
      if (match) return match;
    }
  }

  const byId = contracts.find(c => c.contractId === input.trim());
  if (byId) return byId;

  const prefix = contracts.find(c => c.contractName.startsWith(normalized));
  if (prefix) return prefix;

  return null;
}

export function findCoin(coins: CoinMeta[], coinId: string): CoinMeta | null {
  return coins.find(c => c.coinId === coinId) ?? null;
}

export function formatSymbolName(contract: ContractMeta): string {
  return contract.contractName ?? contract.contractId;
}
