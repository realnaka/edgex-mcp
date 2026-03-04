# edgex-mcp

MCP (Model Context Protocol) server for [EdgeX](https://pro.edgex.exchange) perpetual contract trading.

Provides 15 AI agent tools for market data, account management, and order execution. Works with Cursor, Claude Code, OpenClaw, and any MCP-compatible AI client.

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

Market data tools work without credentials. Account and trading tools require `EDGEX_ACCOUNT_ID` and `EDGEX_STARK_PRIVATE_KEY`.

## Tools

### Market Data (public, no auth)

| Tool | Description |
|------|-------------|
| `edgex_get_ticker` | 24h ticker: price, volume, OI, funding rate |
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

## License

MIT
