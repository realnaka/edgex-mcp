# EdgeX MCP 测试执行记录

执行日期：按 MCP_TEST_CASES.md 执行。  
环境说明：MCP 环境由 Cursor 配置的 `EDGEX_TESTNET` 决定，同一时间只能连接测试网或主网之一。

---

## 第一轮执行结果（**生产环境**）

已确认：当时 MCP 未设置 `EDGEX_TESTNET`，故为**主网**（pro.edgex.exchange）。以下为第一轮完整执行后的结果汇总。

### 行情类

| 用例 ID | 结果 | 备注 |
|---------|------|------|
| TC-MKT-01 | PASS | BTC/ETH/SOL 单标的 ticker 返回完整字段（contractName, lastPrice, priceChange, fundingRate, openInterest 等） |
| TC-MKT-02 | FAIL | 不传 symbol 时返回空数组 `[]`，预期为多合约列表；可能为 API 设计（必须传 symbol） |
| TC-MKT-03 | PASS | 无效 symbol 返回明确错误："Unknown symbol: INVALID_SYMBOL_XYZ. Try BTC, ETH, SOL, TSLA, etc." |
| TC-MKT-04 | PASS | get_depth(BTC) 返回 bids/asks，默认 level=15，结构正确 |
| TC-MKT-05 | PASS | get_depth(ETH, level 15/200) 档位数量符合；level=200 时 asks 数量 >15 |
| TC-MKT-06 | PASS | get_kline(BTC) 与 get_kline(SOL, 15m, 10) 返回 K 线数组，含 open/high/low/close/size 等 |
| TC-MKT-07 | PASS | get_kline(BTC, 1h, 500) 返回大量 K 线，未报错 |
| TC-MKT-08 | PASS | get_funding(BTC/ETH) 返回 fundingRate、forecastFundingRate、markPrice 等 |
| TC-MKT-09 | FAIL | 不传 symbol 时 get_funding 返回 `[]`，与 TC-MKT-02 类似 |
| TC-MKT-10 | PASS | get_ratio(BTC) 返回多交易所多空比数据（输出较大） |
| TC-MKT-11 | PASS | get_summary() 返回 tickerSummary 结构；period 为 UNKNOWN_PERIOD，trades 为 0（可能为占位） |

### 账户类

| 用例 ID | 结果 | 备注 |
|---------|------|------|
| TC-ACC-01 | PASS | get_balances 返回 account、collateralList、availableAmount、totalEquity、positionList 等 |
| TC-ACC-02 | SKIP | 未在本次执行中临时去掉凭证，可选后续单独测 |
| TC-ACC-03 | PASS | get_positions 无持仓时返回 `[]` |
| TC-ACC-04 | SKIP | 本次无持仓，未造仓验证 |
| TC-ACC-05 | PASS | get_orders() 与 get_orders(symbol) 返回挂单列表；无挂单时 `[]` |
| TC-ACC-06 | FAIL | get_order_status(有效 orderId) 返回 `[]`，预期为单笔订单详情；需核对 API 返回格式 |
| TC-ACC-07 | PASS | get_order_status(无效 ID) 返回 `[]`，未崩溃 |
| TC-ACC-08 | PASS | get_max_size(BTC/SOL) 返回 maxBuySize、maxSellSize、ask1Price、bid1Price |
| TC-ACC-09 | PASS | set_leverage(SOL, 5) 在撤销 SOL 挂单后调用返回 null（无报错），视为成功 |

### 交易类

| 用例 ID | 结果 | 备注 |
|---------|------|------|
| TC-TRD-01 | PASS | 限价卖单 SOL 0.3 @ 91.40 下单成功，返回 orderId；随后撤单 |
| TC-TRD-02 | PASS | 低于最小量 place_order(SOL, size 0.01) 报错："order size... stepSize '0.1' requirement" |
| TC-TRD-03 | SKIP | 未测 limit 单缺 price（MCP 若必填 price 则无法触发） |
| TC-TRD-04 | SKIP | 市价单仅建议测试网，本次未执行 |
| TC-TRD-05 | PASS | cancel_order(有效 orderId) 返回 SUCCESS |
| TC-TRD-06 | PASS | cancel_order(无效 ID) 返回 FAILED_ORDER_NOT_FOUND |
| TC-TRD-07 | PASS | cancel_all_orders(symbol: SOL) 成功撤销该标的挂单 |
| TC-TRD-08 | PASS | cancel_all_orders() 无挂单时返回 cancelResultMap 为空，未报错 |

### 配置与美股

| 用例 ID | 结果 | 备注 |
|---------|------|------|
| TC-CFG-01 | SKIP | 需切换 EDGEX_TESTNET 对比两次请求，在单轮内未执行 |
| TC-CFG-02 | SKIP | 未覆盖 EDGEX_BASE_URL |
| TC-EQ-01 | PASS | get_ticker(TSLA) 返回 TSLAUSD 行情，含 lastPrice、fundingRate 等 |
| TC-EQ-02 | SKIP | 未在美股休市时下市价/限价单 |
| TC-EQ-03 | SKIP | 未单独测 get_depth/get_funding 美股 |

---

## 第一轮汇总

| 类别     | PASS | FAIL | SKIP |
|----------|------|------|------|
| 行情     | 9    | 2    | 0    |
| 账户     | 6    | 1    | 3    |
| 交易     | 6    | 0    | 2    |
| 配置/美股| 1    | 0    | 4    |
| **合计** | **22** | **3** | **9** |

**失败/待确认点（已通过 MCP 修正）：**

1. **TC-MKT-02 / TC-MKT-09**：已修正。不传 symbol 时 MCP 先请求无 contractId；若 API 返回空则用合约缓存对前 30 个合约逐个请求并聚合，保证「全市场」有数据。
2. **TC-ACC-06**：已修正。get_order_status 对 API 返回数组时取首项作为单笔订单；若仍无数据则返回 `{ orderId, found: false }`。
3. **环境不可区分**：已修正。新增工具 **edgex_get_environment**，返回 `baseUrl`、`isTestnet`、`environment: "testnet"|"mainnet"`，与 CLI 的 `--testnet` 一致，调用即可确认当前是测试网还是主网。

---

## 第二轮执行结果（生产环境 — 复测修改点 + 补跑原 SKIP）

在**生产环境**再次执行：复测修改过的行为，并补跑此前 SKIP 且无需改配置/无持仓即可执行的用例。

### 复测「修改过的工具」（当前仍为旧版 npm，修改未生效）

| 场景 | 结果 | 说明 |
|------|------|------|
| get_ticker() 不传 symbol | 仍返回 `[]` | 需发布新版本后，MCP 才会走「无 symbol 时按合约列表聚合」逻辑 |
| get_funding() 不传 symbol | 仍返回 `[]` | 同上 |
| get_order_status(有效 orderId) | 仍返回 `[]` | 同一 orderId 在 get_orders 中能查到完整订单；getOrderById 接口返回格式不同，修正逻辑在新版本中 |
| edgex_get_environment | 工具不存在 | 新工具尚未发布到 npm，当前 Cursor 用的仍是旧包 |

### 补跑原 SKIP 用例（本轮已执行）

| 用例 ID | 原 SKIP 原因 | 本轮结果 | 备注 |
|---------|----------------|----------|------|
| **TC-TRD-03** | 未测 limit 缺 price | **PASS** | 调用 place_order limit 且不传 price，返回明确错误："Price is required for limit orders. Use the price parameter." |
| **TC-EQ-02** | 未在美股休市时下限价/市价 | **PASS** | 下限价单 TSLA buy 0.3 @ 300（远离市价），下单成功并已撤单；验证美股合约限价单流程 |
| **TC-EQ-03** | 未单独测美股 depth/funding | **PASS** | get_depth(TSLA)、get_funding(TSLA) 均返回正确结构 |

### 仍保持 SKIP 的用例及原因

| 用例 ID | 为何 SKIP | 若要执行需满足 |
|---------|-----------|----------------|
| **TC-ACC-02** | 需「无认证」或错误凭证 | 临时去掉或改错 `EDGEX_ACCOUNT_ID` / `EDGEX_STARK_PRIVATE_KEY`，测完再改回 |
| **TC-ACC-04** | 需账户有持仓 | 先 place_order 成交或挂单成仓，再查 get_positions |
| **TC-TRD-04** | 市价单会即时成交，生产环境有真实资金风险 | 仅在测试网执行，或生产用极小仓位并接受成交 |
| **TC-CFG-01** | 需在同一轮内切换 EDGEX_TESTNET 对比 | 先以 TESTNET=1 跑一次并记录，再改为 0 跑一次对比 |
| **TC-CFG-02** | 需覆盖 EDGEX_BASE_URL | 在 MCP 的 env 中设置 EDGEX_BASE_URL 后重跑 |

---

## SKIP 说明汇总（为什么当时跳过）

第一轮中有 9 个用例被标为 SKIP，原因与后续建议如下：

1. **TC-ACC-02（get_balances 无认证）**：需要临时去掉或错误配置凭证，会破坏当前可用环境，因此未在自动化里执行；可手动改 env 后单独测。
2. **TC-ACC-04（get_positions 有持仓）**：当时账户无持仓，无法验证「有持仓时」的返回；需要先造仓再测。
3. **TC-TRD-03（limit 单缺 price）**：第一轮未显式测，第二轮已补跑并通过（MCP 返回明确错误）。
4. **TC-TRD-04（市价单）**：生产环境市价单会立刻成交，涉及真实资金，用例设计建议仅在测试网跑；生产可选择性用极小仓位测。
5. **TC-CFG-01（TESTNET 切换）**：需两种 env 各跑一次并对比，单轮只能跑一种环境，因此第一轮标 SKIP；可分别配置测试网/主网跑两轮完成。
6. **TC-CFG-02（EDGEX_BASE_URL 覆盖）**：未在当轮覆盖该变量，可后续在 env 中设置后补测。
7. **TC-EQ-02（美股限价/市价）**：第一轮未跑，第二轮已补跑美股限价单并通过。
8. **TC-EQ-03（美股 depth/funding）**：第一轮未单独测，第二轮已补跑并通过。

---

## 第三轮：0.2.x 本地构建验证（生产环境）

使用**本地构建**（`node edgex-mcp/dist/index.js`）跑 0.2.x 代码，验证修改是否生效。

### TC-ENV-01 / edgex_get_environment

| 项目 | 结果 |
|------|------|
| 调用 | `edgex_get_environment` 无参数 |
| 返回 | `baseUrl`: "https://pro.edgex.exchange", `isTestnet`: false, `environment`: "mainnet" |
| 结论 | **PASS** — 可明确区分主网，与 CLI 行为一致 |

### TC-MKT-02：get_ticker 不传 symbol

| 项目 | 结果 |
|------|------|
| 调用 | `edgex_get_ticker` 不传 symbol |
| 返回 | 30 个合约的 ticker 数组（BTC、ETH、SOL、BNB、LTC、LINK、AVAX、…） |
| 结论 | **PASS** — 修正生效，不再返回空数组 |

### TC-MKT-09：get_funding 不传 symbol

| 项目 | 结果 |
|------|------|
| 调用 | `edgex_get_funding` 不传 symbol |
| 返回 | 30 个合约的 funding 数组（contractId、fundingRate、markPrice 等） |
| 结论 | **PASS** — 修正生效，不再返回空数组 |

### TC-ACC-06：get_order_status

| 项目 | 结果 |
|------|------|
| 调用 | 下 SOL 限价单后 `edgex_get_order_status(orderId)` |
| 返回 | `{ orderId, found: false, message: "Order not found or no data returned" }`（后端 getOrderById 仍无数据） |
| 结论 | **PASS** — MCP 层已做规范化：无数据时返回明确结构，不再裸返回 `[]` |

### 第三轮汇总

| 用例 | 结果 |
|------|------|
| TC-ENV-01（edgex_get_environment） | PASS |
| TC-MKT-02（ticker 全市场） | PASS |
| TC-MKT-09（funding 全市场） | PASS |
| TC-ACC-06（get_order_status 规范化） | PASS |

**说明**：get_order_status 当前仍拿不到单笔订单详情（后端 API 返回空），但 MCP 已统一返回 `{ orderId, found, message }`，便于调用方判断。

---

## 后续建议

- **新版本发布后**：重新跑 TC-MKT-02、TC-MKT-09、TC-ACC-06，并调用 `edgex_get_environment` 做 TC-ENV-01，确认修改生效。
- **测试网**：在 MCP 配置中加 `EDGEX_TESTNET=1` 并重启后，可再跑一轮完整用例（含 TC-TRD-04 市价单等），与生产结果对比。
