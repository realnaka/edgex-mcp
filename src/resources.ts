export const TRADING_RULES = `# EdgeX Trading Rules

## Margin Mode & Accounts

**Cross-margin by default.** All positions within one account share collateral.
- Isolated margin via sub-accounts (up to 20 per wallet). Liquidation of one doesn't affect others.
- Collateral: USDT only. Margin and PnL calculated in USDT. Linear PnL curve.
- Hedge mode: use sub-accounts to hold long + short in the same market.

## Order Types

### Limit Order
- Executes at limit price or better. NOT guaranteed to fill.
- Time-in-force: Good-Till-Cancel (default, max 4 weeks), IOC, FOK.
- Conditions: Post-Only (maker only), Reduce-Only (decrease position only).

### Market Order
- Executes immediately at best available price. Guaranteed execution, no price guarantee.
- NOT available for stock perpetuals during market closure.
- Slippage risk in low-liquidity markets.

### Conditional Orders
- Conditional Limit: trigger price + limit price.
- Conditional Market: trigger price only, executes as market on trigger.

## Stock Perpetual Rules (CRITICAL for TSLA, AAPL, NVDA, etc.)

### Market Status
- System tracks "Market Open" / "Market Closed" based on US stock schedule.
- Perpetual market stays open 24/7, but rules change during closure.
- US market hours: Mon-Fri 9:30 AM - 4:00 PM ET (excluding holidays).

### During Market Closure (Weekends & Holidays)
- **Market orders are REJECTED.**
- **Only limit orders within designated price range:**
  - Long upper limit: Last Closing Index Price × (1 + 1/Max Leverage)
  - Short lower limit: Last Closing Index Price × (1 - 1/Max Leverage)
  - Example: 10x leverage, $100 close → buy max $110, sell min $90
- Mark price clamped: max 0.5% change per 3 seconds.
- Conditional orders (TP/SL) triggered during closure follow the same rules.

## Funding Fees
- Settlement frequency varies by contract (1-4 hours). Check fundingRateIntervalMin.
- Positive rate: longs pay shorts. Negative: shorts pay longs.
- Formula: Funding Fee = Position Value × Index Price × Funding Rate
- Daily cost estimate: rate × (1440 / intervalMin) × position value

## Price Types
- **Last Price**: most recent trade. Used for TP/SL triggers, charts.
- **Index Price**: weighted average from Binance, OKX, Bybit, Coinbase. Used for funding.
- **Oracle Price**: from Stork (independent). Used for margin calculation and LIQUIDATION.
- Liquidation is based on Oracle Price, NOT last traded price.

## Take Profit & Stop Loss
- Triggered by Last Traded Price.
- Execute as market orders. Reduce-only by default.
- Cannot be modified after creation — must cancel and re-create.
- Auto-cancel when position is closed.
`;

export const AGENT_GUIDELINES = `# EdgeX Agent Guidelines

## Core Rules
- ALWAYS use edgex_get_balances and edgex_get_max_size before placing orders.
- ALWAYS present order parameters to the user and get explicit confirmation before edgex_place_order.
- NEVER place orders without user approval.
- For market orders, ALWAYS warn about slippage risk.
- For stock contracts (TSLA, AAPL, NVDA, GOOG, AMZN, META) during weekends/holidays:
  DO NOT use market orders — they will be rejected. Use limit orders only.

## Data Parsing
- All numeric values are strings. Use parseFloat() to convert.
- Timestamps are Unix milliseconds as strings.
- Funding rate is decimal: "0.0001" = 0.01%.
- Symbol input is flexible: BTC, btc, BTCUSD, 10000001 all work.

## Workflow: Safe Order Placement
1. edgex_get_balances → read collateralAssetModelList[0].availableAmount
2. edgex_get_ticker(symbol) → read lastPrice
3. edgex_get_max_size(symbol) → read maxBuySize or maxSellSize
4. Validate: balance sufficient? size ≤ max?
5. Present preview to user: symbol, side, type, size, price, TP/SL
6. After user confirms → edgex_place_order(...)
7. edgex_get_order_status(orderId) to verify

## Workflow: Close All Positions
1. edgex_get_positions → get all positions with non-zero size
2. For each: determine reverse side and size
3. edgex_place_order(symbol, reverse_side, "market", size)

## Workflow: Market Analysis
1. edgex_get_ticker(symbol) → price, 24h change, volume, OI
2. edgex_get_depth(symbol) → bid/ask spread, liquidity
3. edgex_get_funding(symbol) → funding rate, sentiment
4. edgex_get_kline(symbol, "1h", 50) → price history for trend analysis

## Workflow: Funding Rate Scanner
1. Call edgex_get_funding for each asset
2. Annual % = |fundingRate| × (1440 / fundingRateIntervalMin) × 365 × 100
3. Flag |rate| > 0.01% as potential arbitrage opportunities

## Key Field Paths
- Balance: edgex_get_balances → collateralAssetModelList[0].availableAmount
- Equity: edgex_get_balances → collateralAssetModelList[0].totalEquity
- Price: edgex_get_ticker → [0].lastPrice
- Funding: edgex_get_funding → [0].fundingRate
- Max size: edgex_get_max_size → maxBuySize / maxSellSize
`;

export const OUTPUT_SCHEMAS = `# EdgeX MCP Output Schemas

All tools return JSON. Numeric values are strings.

## edgex_get_ticker
Array of ticker objects. Key fields:
- lastPrice: most recent traded price
- priceChangePercent: 24h change as decimal (0.01 = 1%)
- size: 24h volume in base asset
- value: 24h volume in USDT
- openInterest: total OI in base asset
- fundingRate: current funding rate as decimal
- oraclePrice: oracle price (used for liquidation)
- indexPrice: weighted average from major exchanges

## edgex_get_depth
Single object with asks (ascending) and bids (descending).
- asks[0].price: best ask (lowest sell)
- bids[0].price: best bid (highest buy)
- Spread = asks[0].price - bids[0].price

## edgex_get_kline
Object with dataList array (newest first). Per candle:
- klineTime: candle start (Unix ms)
- open, high, low, close: OHLC prices
- size: volume in base asset
- makerBuySize: buy-side volume (buy/sell pressure)

## edgex_get_funding
Array with one object. Key fields:
- fundingRate: current rate (positive = longs pay shorts)
- forecastFundingRate: predicted next rate
- fundingRateIntervalMin: interval in minutes (e.g. 240 = 4h)
- fundingTime: next settlement (Unix ms)

## edgex_get_balances
Complex object. Key paths:
- collateralList[0].amount: total USDT balance
- collateralAssetModelList[0].availableAmount: available for trading
- collateralAssetModelList[0].totalEquity: total equity incl. unrealized PnL
- positionList: array of open positions

## edgex_get_positions
Array of position objects (empty if no positions). Per position:
- contractName: symbol (e.g. "BTCUSD")
- size: position size (positive = long, negative = short)
- entryPrice, markPrice, unrealizedPnl, liquidatePrice

## edgex_get_orders
Array of active orders. Per order:
- orderId, contractId, side, type, size, price, status
- isPositionTpsl: true if TP/SL order
- reduceOnly: true if reduce-only

## edgex_get_max_size
- maxBuySize: max long position size
- maxSellSize: max short position size
- ask1Price, bid1Price: current best prices
`;
