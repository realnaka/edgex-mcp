import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import type { EdgexConfig } from './types.js';

const CONFIG_DIR = join(homedir(), '.edgex');
const IS_UNIX = platform() !== 'win32';

const MAINNET_DEFAULTS: Pick<EdgexConfig, 'baseUrl' | 'wsUrl'> = {
  baseUrl: 'https://pro.edgex.exchange',
  wsUrl: 'wss://quote.edgex.exchange',
};

const TESTNET_DEFAULTS: Pick<EdgexConfig, 'baseUrl' | 'wsUrl'> = {
  baseUrl: 'https://testnet.edgex.exchange',
  wsUrl: 'wss://quote-testnet.edgex.exchange',
};

export function isTestnet(): boolean {
  return process.env.EDGEX_TESTNET === '1' || process.env.EDGEX_TESTNET === 'true';
}

function getConfigFile(): string {
  return join(CONFIG_DIR, isTestnet() ? 'config-testnet.json' : 'config.json');
}

export function getContractsCacheFile(): string {
  return join(CONFIG_DIR, isTestnet() ? 'contracts-testnet.json' : 'contracts.json');
}

export async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  if (IS_UNIX) {
    await chmod(CONFIG_DIR, 0o700).catch(() => {});
  }
}

export async function loadConfig(): Promise<EdgexConfig> {
  const testnet = isTestnet();
  const defaults = testnet ? TESTNET_DEFAULTS : MAINNET_DEFAULTS;

  const envConfig: Partial<EdgexConfig> = {};
  if (process.env.EDGEX_ACCOUNT_ID) envConfig.accountId = process.env.EDGEX_ACCOUNT_ID;
  if (process.env.EDGEX_STARK_PRIVATE_KEY) envConfig.starkPrivateKey = process.env.EDGEX_STARK_PRIVATE_KEY;
  if (process.env.EDGEX_BASE_URL) envConfig.baseUrl = process.env.EDGEX_BASE_URL;
  if (process.env.EDGEX_WS_URL) envConfig.wsUrl = process.env.EDGEX_WS_URL;

  let fileConfig: Partial<EdgexConfig> = {};
  const configFile = getConfigFile();
  try {
    const raw = await readFile(configFile, 'utf-8');
    fileConfig = JSON.parse(raw);
  } catch {
    // No config file yet
  }

  return { ...defaults, ...fileConfig, ...envConfig };
}

export function loadConfigSync(): EdgexConfig {
  const testnet = isTestnet();
  const defaults = testnet ? TESTNET_DEFAULTS : MAINNET_DEFAULTS;

  let fileConfig: Partial<EdgexConfig> = {};
  const configFile = getConfigFile();
  try {
    if (existsSync(configFile)) {
      fileConfig = JSON.parse(readFileSync(configFile, 'utf-8'));
    }
  } catch { /* ignore */ }

  return { ...defaults, ...fileConfig } as EdgexConfig;
}

export async function saveConfig(config: Partial<EdgexConfig>): Promise<void> {
  await ensureConfigDir();

  const configFile = getConfigFile();
  let existing: Partial<EdgexConfig> = {};
  try {
    const raw = await readFile(configFile, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // Start fresh
  }

  const merged = { ...existing, ...config };
  await writeFile(configFile, JSON.stringify(merged, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  if (IS_UNIX) {
    await chmod(configFile, 0o600).catch(() => {});
  }
}

export function getConfigPath(): string {
  return getConfigFile();
}

export function configFileExists(): boolean {
  return existsSync(getConfigFile());
}
