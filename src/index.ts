#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EdgexClient } from './core/client.js';
import { loadConfig, isTestnet, getConfigPath, configFileExists } from './core/config.js';
import { loadCachedContracts, saveCachedContracts, resolveSymbol, getCachedCoins, findCoin } from './core/symbols.js';
import { computeL2OrderFields } from './core/l2-signer.js';
import type { L2OrderInput, L2OrderMeta } from './core/l2-signer.js';
import type { ContractMeta, CoinMeta } from './core/types.js';
import { setupProxy, getActiveProxy } from './core/proxy.js';
import { TRADING_RULES, AGENT_GUIDELINES, OUTPUT_SCHEMAS } from './resources.js';

// ─── State ───

let client: EdgexClient;
let contracts: ContractMeta[] = [];
let coins: CoinMeta[] = [];

async function ensureClient(): Promise<EdgexClient> {
  if (!client) {
    const config = await loadConfig();
    client = new EdgexClient(config);
  }
  return client;
}

async function ensureContracts(): Promise<ContractMeta[]> {
  if (contracts.length > 0) return contracts;

  const cached = await loadCachedContracts();
  if (cached && cached.length > 0) {
    contracts = cached;
    coins = getCachedCoins() ?? [];
    return contracts;
  }

  const c = await ensureClient();
  const meta = await c.getMetaData();
  contracts = meta.contractList;
  coins = meta.coinList;
  await saveCachedContracts(contracts, coins);
  return contracts;
}

async function resolve(symbol: string): Promise<ContractMeta> {
  const list = await ensureContracts();
  const found = resolveSymbol(list, symbol);
  if (!found) throw new Error(`Unknown symbol: ${symbol}. Try BTC, ETH, SOL, TSLA, etc.`);
  return found;
}

function textResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(msg: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { content: [{ type: 'text' as const, text: msg }], isError: true };
}

// ─── Kline interval mapping ───

const KLINE_MAP: Record<string, string> = {
  '1m': 'MINUTE_1', '5m': 'MINUTE_5', '15m': 'MINUTE_15', '30m': 'MINUTE_30',
  '1h': 'HOUR_1', '2h': 'HOUR_2', '4h': 'HOUR_4', '6h': 'HOUR_6',
  '12h': 'HOUR_12', '1d': 'DAY_1', '1w': 'WEEK_1', '1M': 'MONTH_1',
};

// ─── Server Setup ───

const server = new McpServer(
  { name: 'edgex', version: '0.1.0' },
  {
    instructions: `EdgeX MCP server for perpetual contract trading on EdgeX exchange.

FIRST STEP — always call edgex_get_auth_status when starting a session to check if authentication is configured.
- If authenticated: all tools are available (market data + trading).
- If NOT authenticated: only public market data tools work. Guide the user to configure credentials before attempting account/trading operations.

Key rules for AI agents:
- Call edgex_get_environment to see current baseUrl and whether you are on testnet or mainnet (environment: "testnet" | "mainnet"). Like CLI --testnet, this is determined by EDGEX_TESTNET=1.
- Check edgex_get_balances and edgex_get_max_size before placing any order — skipping these risks margin rejection or oversized orders.
- Present order parameters to the user and get explicit confirmation before calling edgex_place_order — trading involves real money.
- For stock contracts (TSLA, AAPL, NVDA, etc.) during market closure: market orders are rejected by the exchange. Use limit orders only.
- Market orders can slip significantly in thin order books — warn the user before proceeding.
- All numeric values are returned as strings. Use parseFloat() to parse.
- Funding rate is a decimal: "0.0001" = 0.01%. Positive = longs pay shorts.
- EdgeX uses cross-margin by default. All positions share collateral.
- Oracle Price (from Stork) is used for liquidation, not last traded price — so even if lastPrice doesn't hit liquidation, oraclePrice might.

Read the resources 'edgex://trading-rules' and 'edgex://agent-guidelines' for detailed trading rules and best practices.`,
  },
);

// ═══════════════════════════════════════════
//  RESOURCES — contextual docs for AI agents
// ═══════════════════════════════════════════

server.resource(
  'trading-rules',
  'edgex://trading-rules',
  { description: 'EdgeX trading rules: margin, stock contract restrictions, order types, funding, liquidation, price types', mimeType: 'text/markdown' },
  async () => ({
    contents: [{
      uri: 'edgex://trading-rules',
      mimeType: 'text/markdown',
      text: TRADING_RULES,
    }],
  }),
);

server.resource(
  'agent-guidelines',
  'edgex://agent-guidelines',
  { description: 'Best practices and workflows for AI agents using EdgeX MCP tools', mimeType: 'text/markdown' },
  async () => ({
    contents: [{
      uri: 'edgex://agent-guidelines',
      mimeType: 'text/markdown',
      text: AGENT_GUIDELINES,
    }],
  }),
);

server.resource(
  'output-schemas',
  'edgex://output-schemas',
  { description: 'JSON response schemas for all EdgeX MCP tools', mimeType: 'text/markdown' },
  async () => ({
    contents: [{
      uri: 'edgex://output-schemas',
      mimeType: 'text/markdown',
      text: OUTPUT_SCHEMAS,
    }],
  }),
);

// ═══════════════════════════════════════════
//  AUTH STATUS & ENVIRONMENT
// ═══════════════════════════════════════════

server.tool(
  'edgex_get_auth_status',
  'Check if authentication is configured. CALL THIS FIRST at the start of every session. Returns whether account credentials are set up and what tools are available.',
  {},
  async () => {
    try {
      const config = await loadConfig();
      const hasAuth = !!(config.accountId && config.starkPrivateKey);
      const testnet = isTestnet();
      const configPath = getConfigPath();
      const fileExists = configFileExists();

      if (hasAuth) {
        return textResult({
          authenticated: true,
          accountId: config.accountId,
          environment: testnet ? 'testnet' : 'mainnet',
          configSource: process.env.EDGEX_ACCOUNT_ID ? 'environment_variables' : 'config_file',
          configPath,
          availableTools: 'All tools available: market data, account, and trading.',
        });
      }

      return textResult({
        authenticated: false,
        environment: testnet ? 'testnet' : 'mainnet',
        configPath,
        configFileExists: fileExists,
        availableTools: 'Only public market data tools (ticker, depth, kline, funding, ratio, summary). Account and trading tools require authentication.',
        setupInstructions: {
          option1_cli: 'Install edgex-cli (npm i -g @realnaka/edgex-cli) then run: edgex setup',
          option2_env: 'Add env vars to .cursor/mcp.json under the edgex server: "env": { "EDGEX_ACCOUNT_ID": "your_id", "EDGEX_STARK_PRIVATE_KEY": "0x..." }',
          option3_file: `Create ${configPath} with: { "accountId": "your_id", "starkPrivateKey": "0x..." }`,
          afterSetup: 'Restart MCP server by reloading the Cursor window (Cmd+Shift+P → Reload Window).',
        },
      });
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_environment',
  'Get current MCP environment: baseUrl, testnet/mainnet, and auth status.',
  {},
  async () => {
    try {
      const config = await loadConfig();
      const testnet = isTestnet();
      const hasAuth = !!(config.accountId && config.starkPrivateKey);
      const env = {
        baseUrl: config.baseUrl,
        wsUrl: config.wsUrl,
        isTestnet: testnet,
        environment: testnet ? 'testnet' : 'mainnet',
        authenticated: hasAuth,
        ...(hasAuth ? { accountId: config.accountId } : {}),
        proxy: getActiveProxy() ?? 'none',
      };
      return textResult(env);
    } catch (e: any) { return errorResult(e.message); }
  },
);

// ═══════════════════════════════════════════
//  PUBLIC MARKET DATA TOOLS
// ═══════════════════════════════════════════

server.tool(
  'edgex_get_ticker',
  'Get 24h ticker: price, volume, open interest, funding rate. Omit symbol to get all contracts (uses cached contract list, may return subset).',
  { symbol: z.string().optional().describe('e.g. BTC, ETH, SOL, TSLA') },
  async ({ symbol }) => {
    try {
      const c = await ensureClient();
      if (symbol) {
        const contract = await resolve(symbol);
        const data = await c.getTicker(contract.contractId);
        return textResult(data);
      }
      // No symbol: try API without contractId first; if empty, fallback to first N contracts from cache
      let data = await c.getTicker(undefined);
      if (Array.isArray(data) && data.length > 0) return textResult(data);
      const list = await ensureContracts();
      const maxAll = 30;
      const tickers: unknown[] = [];
      for (let i = 0; i < Math.min(list.length, maxAll); i++) {
        const row = await c.getTicker(list[i]!.contractId);
        if (Array.isArray(row) && row[0]) tickers.push(row[0]);
      }
      return textResult(tickers);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_depth',
  'Get order book depth (bids and asks) for a contract.',
  {
    symbol: z.string().describe('e.g. BTC, ETH, SOL'),
    level: z.enum(['15', '200']).optional().describe('Depth levels (default: 15)'),
  },
  async ({ symbol, level }) => {
    try {
      const c = await ensureClient();
      const contract = await resolve(symbol);
      const data = await c.getDepth(contract.contractId, level ?? '15');
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_kline',
  'Get candlestick/kline data for technical analysis.',
  {
    symbol: z.string().describe('e.g. BTC, ETH, SOL'),
    interval: z.enum(['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w', '1M']).optional().describe('Candle interval (default: 1h)'),
    count: z.number().int().min(1).max(500).optional().describe('Number of candles (default: 100, max: 500)'),
  },
  async ({ symbol, interval, count }) => {
    try {
      const c = await ensureClient();
      const contract = await resolve(symbol);
      const klineType = KLINE_MAP[interval ?? '1h'] ?? 'HOUR_1';
      const data = await c.getKline(contract.contractId, klineType, String(count ?? 100));
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_funding',
  'Get current and predicted funding rate. Positive = longs pay shorts. Omit symbol for first N contracts from cache.',
  { symbol: z.string().optional().describe('e.g. BTC, ETH, SOL. Omit for all.') },
  async ({ symbol }) => {
    try {
      const c = await ensureClient();
      if (symbol) {
        const contract = await resolve(symbol);
        const data = await c.getLatestFundingRate(contract.contractId);
        return textResult(data);
      }
      let data = await c.getLatestFundingRate(undefined);
      if (Array.isArray(data) && data.length > 0) return textResult(data);
      const list = await ensureContracts();
      const maxAll = 30;
      const out: unknown[] = [];
      for (let i = 0; i < Math.min(list.length, maxAll); i++) {
        const row = await c.getLatestFundingRate(list[i]!.contractId);
        if (Array.isArray(row) && row[0]) out.push(row[0]);
      }
      return textResult(out);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_ratio',
  'Get long/short ratio aggregated from multiple exchanges (Binance, OKX, Bybit, etc.).',
  { symbol: z.string().optional().describe('e.g. BTC, ETH, SOL') },
  async ({ symbol }) => {
    try {
      const c = await ensureClient();
      let contractId: string | undefined;
      if (symbol) {
        const contract = await resolve(symbol);
        contractId = contract.contractId;
      }
      const data = await c.getLongShortRatio(contractId);
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_summary',
  'Get market-wide volume and trading summary.',
  {},
  async () => {
    try {
      const c = await ensureClient();
      const data = await c.getTickerSummary();
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

// ═══════════════════════════════════════════
//  ACCOUNT TOOLS (requires auth)
// ═══════════════════════════════════════════

server.tool(
  'edgex_get_balances',
  'Get account balances, positions, and equity. Requires EDGEX_ACCOUNT_ID and EDGEX_STARK_PRIVATE_KEY.',
  {},
  async () => {
    try {
      const c = await ensureClient();
      const data = await c.getAccountAsset();
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_positions',
  'Get open positions with unrealized PnL. Returns empty array if no positions.',
  {},
  async () => {
    try {
      const c = await ensureClient();
      const data = await c.getAccountAsset();
      return textResult((data as any).positionList ?? []);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_orders',
  'Get active/pending orders.',
  { symbol: z.string().optional().describe('Filter by symbol') },
  async ({ symbol }) => {
    try {
      const c = await ensureClient();
      let contractId: string | undefined;
      if (symbol) {
        const contract = await resolve(symbol);
        contractId = contract.contractId;
      }
      const data = await c.getActiveOrders(contractId);
      return textResult(data.dataList ?? []);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_order_status',
  'Get status of a specific order by ID.',
  { orderId: z.string().describe('The order ID to query') },
  async ({ orderId }) => {
    try {
      const c = await ensureClient();
      const data = await c.getOrderById(orderId);
      // Normalize: API may return array, single object, or wrapper { order/data }
      let order: unknown = null;
      if (Array.isArray(data)) {
        order = (data as unknown[]).length > 0 ? (data as unknown[])[0] : null;
      } else if (data != null && typeof data === 'object') {
        const obj = data as unknown as Record<string, unknown>;
        if ('order' in obj && obj.order != null && typeof obj.order === 'object') {
          order = obj.order;
        } else if ('data' in obj && obj.data != null && typeof obj.data === 'object') {
          order = obj.data;
        } else if ('id' in obj || 'orderId' in obj || 'status' in obj) {
          order = data;
        } else {
          order = data;
        }
      }
      if (order == null) {
        return textResult({ orderId, found: false, message: 'Order not found or no data returned' });
      }
      return textResult(order);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_get_max_size',
  'Get maximum order size for a contract given current balance and leverage.',
  { symbol: z.string().describe('e.g. BTC, ETH, SOL') },
  async ({ symbol }) => {
    try {
      const c = await ensureClient();
      const contract = await resolve(symbol);
      const data = await c.getMaxCreateOrderSize(contract.contractId);
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_set_leverage',
  'Set leverage for a contract. EdgeX uses cross-margin mode.',
  {
    symbol: z.string().describe('e.g. BTC, ETH, SOL'),
    leverage: z.number().int().min(1).max(100).describe('Leverage multiplier (1-100)'),
  },
  async ({ symbol, leverage }) => {
    try {
      const c = await ensureClient();
      const contract = await resolve(symbol);
      const data = await c.updateLeverageSetting(contract.contractId, String(leverage));
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

// ═══════════════════════════════════════════
//  TRADING TOOLS (requires auth)
// ═══════════════════════════════════════════

server.tool(
  'edgex_place_order',
  'Place a limit or market order. For stock contracts during market closure, only limit orders are allowed. ALWAYS confirm with the user before calling this tool.',
  {
    symbol: z.string().describe('e.g. BTC, ETH, SOL, TSLA'),
    side: z.enum(['buy', 'sell']).describe('Order side'),
    type: z.enum(['limit', 'market']).describe('Order type'),
    size: z.string().describe('Order size in base asset (e.g. "0.01" for BTC)'),
    price: z.string().optional().describe('Limit price (required for limit orders)'),
    tp: z.string().optional().describe('Take-profit trigger price'),
    sl: z.string().optional().describe('Stop-loss trigger price'),
  },
  async ({ symbol, side, type, size, price, tp, sl }) => {
    try {
      if (type === 'limit' && !price) {
        return errorResult('Price is required for limit orders. Use the price parameter.');
      }

      const c = await ensureClient();
      const config = await loadConfig();
      await ensureContracts();
      const contract = await resolve(symbol);
      const coinList = coins.length > 0 ? coins : getCachedCoins() ?? [];
      const quoteCoin = coinList.find((coin: CoinMeta) => coin.coinId === (contract.quoteCoinId ?? '1000'));

      if (!contract.starkExSyntheticAssetId || !quoteCoin?.starkExAssetId) {
        return errorResult(`Missing StarkEx metadata for ${contract.contractName}. Try deleting ~/.edgex/contracts.json and retry.`);
      }

      const sideUpper = side.toUpperCase() as 'BUY' | 'SELL';
      const typeUpper = type.toUpperCase() as 'LIMIT' | 'MARKET';

      let orderPrice = price ?? '0';
      let oracleStr: string | undefined;

      if (type === 'market') {
        const tickers = await c.getTicker(contract.contractId);
        oracleStr = tickers[0]?.oraclePrice ?? '0';
        orderPrice = '0';
      }

      const l2Meta: L2OrderMeta = {
        starkExSyntheticAssetId: contract.starkExSyntheticAssetId,
        syntheticResolution: contract.starkExResolution ?? '1',
        collateralAssetId: quoteCoin.starkExAssetId,
        collateralResolution: quoteCoin.starkExResolution ?? '1',
        feeRate: contract.defaultTakerFeeRate ?? '0.001',
        tickSize: contract.tickSize,
      };

      const l2Input: L2OrderInput = {
        side: sideUpper,
        type: typeUpper,
        size,
        price: price,
        oraclePrice: oracleStr,
        accountId: config.accountId!,
      };

      const l2Fields = computeL2OrderFields(l2Input, l2Meta, config.starkPrivateKey!);

      const orderParams: Record<string, unknown> = {
        contractId: contract.contractId,
        side: sideUpper,
        type: typeUpper,
        size,
        price: orderPrice,
        timeInForce: 'GOOD_TIL_CANCEL',
        ...l2Fields,
      };

      if (tp || sl) {
        const reverseSide = sideUpper === 'BUY' ? 'SELL' : 'BUY';

        if (tp) {
          const tpInput: L2OrderInput = {
            side: reverseSide,
            type: 'MARKET',
            size,
            oraclePrice: tp,
            accountId: config.accountId!,
          };
          const tpL2 = computeL2OrderFields(tpInput, l2Meta, config.starkPrivateKey!);
          orderParams.openTp = {
            side: reverseSide,
            type: 'TAKE_PROFIT_MARKET',
            size,
            price: '0',
            triggerPrice: tp,
            triggerPriceType: 'LAST_PRICE',
            ...tpL2,
          };
        }

        if (sl) {
          const slInput: L2OrderInput = {
            side: reverseSide,
            type: 'MARKET',
            size,
            oraclePrice: sl,
            accountId: config.accountId!,
          };
          const slL2 = computeL2OrderFields(slInput, l2Meta, config.starkPrivateKey!);
          orderParams.openSl = {
            side: reverseSide,
            type: 'STOP_MARKET',
            size,
            price: '0',
            triggerPrice: sl,
            triggerPriceType: 'LAST_PRICE',
            ...slL2,
          };
        }
      }

      const data = await c.createOrder(orderParams);
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_cancel_order',
  'Cancel one or more orders by ID.',
  { orderIds: z.array(z.string()).min(1).describe('Array of order IDs to cancel') },
  async ({ orderIds }) => {
    try {
      const c = await ensureClient();
      const data = await c.cancelOrderById(orderIds);
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

server.tool(
  'edgex_cancel_all_orders',
  'Cancel all active orders, optionally filtered by symbol.',
  { symbol: z.string().optional().describe('Only cancel orders for this symbol') },
  async ({ symbol }) => {
    try {
      const c = await ensureClient();
      let contractId: string | undefined;
      if (symbol) {
        const contract = await resolve(symbol);
        contractId = contract.contractId;
      }
      const data = await c.cancelAllOrder(contractId);
      return textResult(data);
    } catch (e: any) { return errorResult(e.message); }
  },
);

// ─── Start Server ───

async function main(): Promise<void> {
  await setupProxy();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
