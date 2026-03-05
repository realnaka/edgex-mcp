# edgex-mcp

MCP (Model Context Protocol) server for [EdgeX](https://pro.edgex.exchange) perpetual contract trading.

Provides 16 AI agent tools for market data, account management, and order execution. Works with Cursor, Claude Code, OpenClaw, and any MCP-compatible AI client. Use **testnet** by setting `EDGEX_TESTNET=1` in the MCP env (like the CLI `--testnet` flag).

## Setup

Add to your MCP configuration:

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "edgex": {
      "command": "npx",
      "args": ["-y", "@realnaka/edgex-mcp"],
      "env": {
        "EDGEX_ACCOUNT_ID": "your-account-id",
        "EDGEX_STARK_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "edgex": {
      "command": "npx",
      "args": ["-y", "@realnaka/edgex-mcp"],
      "env": {
        "EDGEX_ACCOUNT_ID": "your-account-id",
        "EDGEX_STARK_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

**OpenClaw** (`~/.openclaw/openclaw.json`):

> **Prerequisite**: OpenClaw does not natively support MCP. Install MCP Porter first:
>
> ```bash
> npx clawhub@latest install mcporter
> ```
>
> Then configure the MCP server below. MCP Porter acts as a bridge between OpenClaw and MCP servers.

```json
{
  "mcp": {
    "servers": {
      "edgex": {
        "command": "npx",
        "args": ["-y", "@realnaka/edgex-mcp"],
        "env": {
          "EDGEX_ACCOUNT_ID": "your-account-id",
          "EDGEX_STARK_PRIVATE_KEY": "0x..."
        }
      }
    }
  }
}
```

Market data tools work without credentials. Account and trading tools require `EDGEX_ACCOUNT_ID` and `EDGEX_STARK_PRIVATE_KEY`.

## Tools

### Environment (no auth)

| Tool | Description |
|------|-------------|
| `edgex_get_environment` | Current baseUrl, isTestnet, environment ("testnet" \| "mainnet"). Call this to confirm testnet vs mainnet before trading. |

### Market Data (public, no auth)

| Tool | Description |
|------|-------------|
| `edgex_get_ticker` | 24h ticker: price, volume, OI, funding rate. Omit symbol for multiple contracts. |
| `edgex_get_depth` | Order book bids/asks |
| `edgex_get_kline` | Candlestick data (1m to 1M intervals) |
| `edgex_get_funding` | Current and predicted funding rate |
| `edgex_get_ratio` | Long/short ratio from multiple exchanges |
| `edgex_get_summary` | Market-wide volume summary |

### Account (requires auth)

| Tool | Description |
|------|-------------|
| `edgex_get_balances` | Account balances, equity, margin |
| `edgex_get_positions` | Open positions with unrealized PnL |
| `edgex_get_orders` | Active/pending orders |
| `edgex_get_order_status` | Status of a specific order |
| `edgex_get_max_size` | Max order size given current balance |
| `edgex_set_leverage` | Set leverage per contract (cross-margin) |

### Trading (requires auth)

| Tool | Description |
|------|-------------|
| `edgex_place_order` | Place limit/market orders with optional TP/SL |
| `edgex_cancel_order` | Cancel orders by ID |
| `edgex_cancel_all_orders` | Cancel all orders (optionally by symbol) |

## Supported Assets

290+ perpetual contracts:
- **Crypto**: BTC, ETH, SOL, and more
- **US Equities**: TSLA, AAPL, NVDA, GOOG, AMZN, META, and more

Flexible symbol input: `BTC`, `btc`, `BTCUSD`, or contract ID `10000001`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EDGEX_ACCOUNT_ID` | For trading | EdgeX account ID |
| `EDGEX_STARK_PRIVATE_KEY` | For trading | StarkEx private key |
| `EDGEX_TESTNET` | No | Set to `1` for testnet |
| `EDGEX_BASE_URL` | No | Override REST API URL |
| `HTTPS_PROXY` / `https_proxy` | No | HTTP proxy URL (see below) |

## Proxy Configuration

Node.js's built-in `fetch` does not automatically use system proxy settings (`$https_proxy` / `$http_proxy`). If you're behind a proxy (common in China, corporate networks, etc.), requests to the EdgeX API will fail silently.

**The MCP server auto-detects proxy env vars** at startup and configures `fetch` accordingly (requires Node.js >= 20 or `undici` installed). You just need to pass the proxy URL via MCP env config:

```json
{
  "mcpServers": {
    "edgex": {
      "command": "npx",
      "args": ["-y", "@realnaka/edgex-mcp"],
      "env": {
        "HTTPS_PROXY": "http://127.0.0.1:7890",
        "EDGEX_ACCOUNT_ID": "your-account-id",
        "EDGEX_STARK_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

**Why this is needed**: `npx` spawns a new Node.js process that does not inherit your shell's proxy environment variables. You must explicitly pass `HTTPS_PROXY` (or `HTTP_PROXY`) in the MCP `env` block.

**Verify proxy is active**: Call `edgex_get_environment` — the response includes a `proxy` field showing the active proxy URL or `"none"`.

## Security

- Private keys stay on your local machine (never sent to any third-party server)
- The MCP server runs as a local process, communicating via stdin/stdout
- Credentials are passed via environment variables, not stored in config files
- Use sub-account keys and set withdrawal whitelist on your main account

## Resources (for AI agents)

The server exposes three MCP Resources that AI agents can read for context:

| Resource URI | Content |
|---|---|
| `edgex://trading-rules` | Margin, order types, stock contract rules, funding, liquidation |
| `edgex://agent-guidelines` | Safe order workflows, key field paths, data parsing rules |
| `edgex://output-schemas` | JSON response schemas for all tools |

AI clients (Cursor, Claude Code) will automatically discover these via `resources/list` and can read them before performing tasks.

## EdgeX Tool Ecosystem

This project is part of the EdgeX developer ecosystem. Each project is **independent** — choose whichever fits your integration scenario:

| Project | npm Package | For |
|---|---|---|
| **edgex-mcp** (this) | `@realnaka/edgex-mcp` | AI agents via MCP protocol (Cursor, Claude Code, OpenClaw) |
| [edgex-cli](https://github.com/realnaka/edgex-cli) | `@realnaka/edgex-cli` | Humans, shell scripts, and AI agents via SKILL.md |

**Key differences:**
- **edgex-mcp** — structured tool interface, type-safe arguments via MCP protocol, server instructions and resources for AI context. Best for deep AI integration.
- **edgex-cli** — text-based CLI with `--json` output, installable SKILL.md for AI agents. Best for shell scripting and human interaction.

Both connect to the same EdgeX exchange API. You can use them together or independently.

---

## Full Guide

### 1. Installation & Configuration

1. Add the `edgex` entry shown above to your MCP configuration (`command` + `args` + optional `env`).
2. **Market data only**: You can skip `EDGEX_ACCOUNT_ID` and `EDGEX_STARK_PRIVATE_KEY` — all public market data tools work without credentials.
3. **Trading & account access**: Set `EDGEX_ACCOUNT_ID` and `EDGEX_STARK_PRIVATE_KEY` in the MCP `env` block (use the corresponding credentials for mainnet or testnet).

### 2. Testnet vs Mainnet

- **Mainnet (production)**: Leave `EDGEX_TESTNET` unset or set to `0`. Connects to `https://pro.edgex.exchange` with real funds.
- **Testnet**: Set `EDGEX_TESTNET=1` in the MCP `env`. Connects to `https://testnet.edgex.exchange` for safe experimentation.

Always call **`edgex_get_environment`** first and verify that `environment` and `baseUrl` match your expectation before placing any orders.

### 3. Recommended Workflow

1. **Confirm environment**: `edgex_get_environment` → check `environment` ("mainnet" / "testnet").
2. **Check market data**: `edgex_get_ticker`, `edgex_get_funding`, etc. Omit `symbol` for a multi-contract overview, or pass `BTC`, `ETH`, `SOL`, etc.
3. **Before placing orders**: Call `edgex_get_balances` and `edgex_get_max_size` to verify balance and available size. Confirm direction, quantity, and price with the user before calling `edgex_place_order`.
4. **Order management**: Use `edgex_get_orders` to list open orders. Use `edgex_get_order_status(orderId)` for a single order (if it returns `found: false`, fall back to `get_orders`). Cancel with `edgex_cancel_order` or `edgex_cancel_all_orders`.

### 4. Troubleshooting: npx Fails to Start

In some environments, `npx @realnaka/edgex-mcp` may not launch correctly. Use the local build path instead:

```json
"edgex": {
  "command": "node",
  "args": ["/absolute/path/to/edgex-mcp/dist/index.js"],
  "env": { "EDGEX_ACCOUNT_ID": "...", "EDGEX_STARK_PRIVATE_KEY": "0x..." }
}
```

Alternatively, install globally and run directly:

```bash
npm install -g @realnaka/edgex-mcp
# Then use "command": "edgex-mcp" in your MCP config
```

---

## Known Limitations

| Issue | Description | Workaround |
|-------|-------------|------------|
| **get_order_status** | The backend `getOrderById` endpoint may return empty in some cases. The MCP returns `{ orderId, found: false, message: "..." }` when this happens. | Use `edgex_get_orders` to find the order in the full list. The MCP already handles object/array/nested response formats — once the backend returns data, it will be parsed correctly. |
| **npx startup** | Some npm versions may not install the `bin` entry correctly, causing `npx @realnaka/edgex-mcp` to fail. | Use the `node` + local `dist/index.js` approach described above, or install globally with `npm install -g`. |
| **US equity market orders** | Market orders for US equity contracts are rejected outside trading hours. Only limit orders within the allowed price range are accepted. | Use limit orders for equity contracts. See `edgex://trading-rules` for price range details. |
| **Proxy not inherited** | `npx` / Node.js `fetch` do not auto-inherit system proxy env vars, causing connection failures behind proxies. | Pass `HTTPS_PROXY` explicitly in the MCP `env` config. See [Proxy Configuration](#proxy-configuration). |
| **OpenClaw MCP support** | OpenClaw does not natively support MCP protocol. | Install MCP Porter first: `npx clawhub@latest install mcporter`. |

---

## License

MIT
