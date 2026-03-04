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

## 完整使用说明（Full guide）

### 1. 安装与配置

1. 在 Cursor / Claude Code 的 MCP 配置中加入上述 `edgex` 配置（`command` + `args` + 可选 `env`）。
2. **仅查行情**：可不配置 `EDGEX_ACCOUNT_ID`、`EDGEX_STARK_PRIVATE_KEY`，直接使用行情类工具。
3. **下单与查账户**：在 MCP 的 `env` 中配置 `EDGEX_ACCOUNT_ID` 和 `EDGEX_STARK_PRIVATE_KEY`（主网/测试网各用对应账户）。

### 2. 测试网 vs 主网

- **主网（生产）**：不设置 `EDGEX_TESTNET` 或设为 `0`，连接 `https://pro.edgex.exchange`，资金真实。
- **测试网**：在 MCP 的 `env` 中设置 `EDGEX_TESTNET=1`，连接 `https://testnet.edgex.exchange`，用于安全试单。

建议在对话中先调用 **`edgex_get_environment`**，确认返回的 `environment` 与 `baseUrl` 符合预期再下单。

### 3. 推荐使用顺序

1. **确认环境**：`edgex_get_environment` → 看 `environment`（"mainnet" / "testnet"）。
2. **查行情**：`edgex_get_ticker`、`edgex_get_funding` 等（可不传 symbol 查多合约，或传 BTC/ETH/SOL 等）。
3. **下单前**：`edgex_get_balances`、`edgex_get_max_size` 确认余额与可开规模；与用户确认方向、数量、限价后再 `edgex_place_order`。
4. **查单与撤单**：`edgex_get_orders` 查挂单；`edgex_get_order_status(orderId)` 查单笔（若返回 `found: false` 可改用 get_orders）；`edgex_cancel_order` / `edgex_cancel_all_orders` 撤单。

### 4. 若 npx 无法启动（MCP 不出现）

部分环境下 `npx @realnaka/edgex-mcp` 可能无法正确启动，可改用**本地路径**直接跑构建产物：

```json
"edgex": {
  "command": "node",
  "args": ["/绝对路径/到/edgex-mcp/dist/index.js"],
  "env": { "EDGEX_ACCOUNT_ID": "...", "EDGEX_STARK_PRIVATE_KEY": "0x..." }
}
```

或先本地安装再通过 `npm start` 启动（需在 package 目录下执行）：

```bash
npm install -g @realnaka/edgex-mcp
# 在 MCP 配置中使用 "command": "edgex-mcp" 或 "command": "npx", "args": ["-y", "@realnaka/edgex-mcp", "run", "start"]
```

---

## 已知限制（Known limitations）

| 项目 | 说明 | 建议 |
|------|------|------|
| **get_order_status** | 部分环境下后端 `getOrderById` 返回空，MCP 会返回 `{ orderId, found: false, message: "..." }`。 | 需要单笔订单状态时，可先用 `edgex_get_orders` 在列表中查找该 orderId；MCP 已兼容后端返回对象/数组/嵌套格式，后端一旦返回数据即可正常解析。 |
| **npx 启动** | 个别 npm 版本可能未正确安装 bin，导致 `npx @realnaka/edgex-mcp` 无法启动。 | 使用上文「若 npx 无法启动」中的 `node` + 本地 `dist/index.js` 方式，或全局安装后使用 `edgex-mcp` 命令。 |
| **美股市价单** | 美股休市时段市价单会被拒绝，仅限价单在允许价格范围内可用。 | 美股合约请用限价单，或参考 `edgex://trading-rules` 中的价格区间说明。 |

---

## License

MIT
