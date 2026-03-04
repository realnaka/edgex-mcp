# EdgeX MCP 详细测试用例

> 目的：对 EdgeX MCP Server 在**测试网**与**生产环境**下进行完整功能与回归测试。  
> 环境切换：通过环境变量 `EDGEX_TESTNET=1` 使用测试网，不设置或设为 `0` 使用生产环境。  
> 执行前请确认：测试网与生产环境各自配置好对应的 `EDGEX_ACCOUNT_ID`、`EDGEX_STARK_PRIVATE_KEY`（账户类/交易类用例需要）。

---

## 一、测试环境说明

| 环境 | 环境变量 | API Base | 说明 |
|------|----------|----------|------|
| **测试网** | `EDGEX_TESTNET=1` | `https://testnet.edgex.exchange` | 用于安全验证下单、撤单、杠杆等写操作 |
| **生产** | 不设置或 `EDGEX_TESTNET=0` | `https://pro.edgex.exchange` | 真实资金，写操作需谨慎、小额 |

**执行方式建议**  
- 同一套用例跑两遍：先配置测试网 env 跑完全部用例并记录结果，再切到生产 env 重跑并记录。  
- 或使用两套 MCP 配置（如 `edgex-testnet` / `edgex`），分别指向测试网与生产。

---

## 二、工具清单与依赖

| 工具 | 分类 | 需要认证 | 测试网 | 生产 |
|------|------|----------|--------|------|
| edgex_get_environment | 环境 | 否 | ✅ | ✅ |
| edgex_get_ticker | 行情 | 否 | ✅ | ✅ |
| edgex_get_depth | 行情 | 否 | ✅ | ✅ |
| edgex_get_kline | 行情 | 否 | ✅ | ✅ |
| edgex_get_funding | 行情 | 否 | ✅ | ✅ |
| edgex_get_ratio | 行情 | 否 | ✅ | ✅ |
| edgex_get_summary | 行情 | 否 | ✅ | ✅ |
| edgex_get_balances | 账户 | 是 | ✅ | ✅ |
| edgex_get_positions | 账户 | 是 | ✅ | ✅ |
| edgex_get_orders | 账户 | 是 | ✅ | ✅ |
| edgex_get_order_status | 账户 | 是 | ✅ | ✅ |
| edgex_get_max_size | 账户 | 是 | ✅ | ✅ |
| edgex_set_leverage | 账户 | 是 | ✅ | ✅ |
| edgex_place_order | 交易 | 是 | ✅ | ✅（谨慎） |
| edgex_cancel_order | 交易 | 是 | ✅ | ✅（谨慎） |
| edgex_cancel_all_orders | 交易 | 是 | ✅ | ✅（谨慎） |

---

## 三、测试用例

### 3.0 环境（无需认证）

#### TC-ENV-01：edgex_get_environment

| 项目 | 内容 |
|------|------|
| 目的 | 确认当前 MCP 连接的是测试网还是主网（与 CLI `--testnet` 等价） |
| 前置 | 无 |
| 步骤 | 调用 `edgex_get_environment`，无参数 |
| 预期 | 返回 `baseUrl`、`isTestnet`、`environment`（"testnet" 或 "mainnet"）；测试网时 baseUrl 含 testnet.edgex.exchange，主网含 pro.edgex.exchange |
| 测试网/生产 | 两环境各执行一次，对比 baseUrl / environment 不同 |

---

### 3.1 行情类（无需认证）

#### TC-MKT-01：edgex_get_ticker（单标的）

| 项目 | 内容 |
|------|------|
| 目的 | 验证按 symbol 获取 24h 行情，且返回字段完整 |
| 前置 | 无；可选不配置认证 |
| 步骤 | 1. 调用 `edgex_get_ticker`，`symbol`: `"BTC"`<br>2. 再调用 `symbol`: `"ETH"`<br>3. 再调用 `symbol`: `"SOL"`（测试网/生产均有） |
| 预期 | 返回数组，每项包含：`contractName`、`lastPrice`、`priceChange`、`priceChangePercent`、`open`、`high`、`low`、`close`、`fundingRate`、`openInterest` 等；价格为字符串且可解析为数字 |
| 测试网/生产 | 两环境均执行，对比结构一致；价格数值可不同 |

#### TC-MKT-02：edgex_get_ticker（全市场）

| 项目 | 内容 |
|------|------|
| 目的 | 验证不传 symbol 时返回多合约行情 |
| 前置 | 无 |
| 步骤 | 调用 `edgex_get_ticker`，不传 `symbol`（或传空） |
| 预期 | 返回数组，长度 > 1，包含 BTC/ETH/SOL 等常见合约 |
| 测试网/生产 | 两环境均执行 |

#### TC-MKT-03：edgex_get_ticker（无效 symbol）

| 项目 | 内容 |
|------|------|
| 目的 | 验证非法或不存在标的时的行为 |
| 步骤 | 调用 `edgex_get_ticker`，`symbol`: `"INVALID_SYMBOL_XYZ"` |
| 预期 | 返回空数组或明确错误信息（不崩溃） |
| 测试网/生产 | 两环境均执行 |

---

#### TC-MKT-04：edgex_get_depth（默认档位）

| 项目 | 内容 |
|------|------|
| 目的 | 验证订单簿深度，默认 level |
| 步骤 | 调用 `edgex_get_depth`，`symbol`: `"BTC"`，不传 `level` |
| 预期 | 返回 bids/asks 数组，每档含价格与数量；结构符合文档/agent-guidelines |
| 测试网/生产 | 两环境均执行 |

#### TC-MKT-05：edgex_get_depth（指定 level）

| 项目 | 内容 |
|------|------|
| 目的 | 验证 level 15 与 200 |
| 步骤 | 1. `symbol`: `"ETH"`，`level`: `"15"`<br>2. `symbol`: `"ETH"`，`level`: `"200"` |
| 预期 | 两次返回的档位数量分别符合 15 与 200（或接口允许的最大档位） |
| 测试网/生产 | 两环境均执行 |

---

#### TC-MKT-06：edgex_get_kline（默认与指定周期）

| 项目 | 内容 |
|------|------|
| 目的 | 验证 K 线数据与 interval/count |
| 步骤 | 1. `symbol`: `"BTC"`，不传 interval/count（默认 1h、100 根）<br>2. `symbol`: `"SOL"`，`interval`: `"15m"`，`count`: `10` |
| 预期 | 返回 K 线数组，每根含 open/high/low/close/volume 等；数量与 interval 符合入参 |
| 测试网/生产 | 两环境均执行 |

#### TC-MKT-07：edgex_get_kline（边界 count）

| 项目 | 内容 |
|------|------|
| 目的 | 验证 count 上限 500 |
| 步骤 | `symbol`: `"BTC"`，`interval`: `"1h"`，`count`: `500` |
| 预期 | 最多返回 500 根 K 线或接口允许的最大数量，不报错 |
| 测试网/生产 | 两环境均执行 |

---

#### TC-MKT-08：edgex_get_funding（单标的）

| 项目 | 内容 |
|------|------|
| 目的 | 验证当前/预测资金费率 |
| 步骤 | 调用 `edgex_get_funding`，`symbol`: `"BTC"`；再测 `"ETH"` |
| 预期 | 返回含 `fundingRate`、`forecastFundingRate` 或 `predictedFundingRate`、`markPrice` 等；正数表示多头付空头 |
| 测试网/生产 | 两环境均执行 |

#### TC-MKT-09：edgex_get_funding（全市场）

| 项目 | 内容 |
|------|------|
| 目的 | 不传 symbol 时返回多合约资金费率 |
| 步骤 | 调用 `edgex_get_funding`，不传 `symbol` |
| 预期 | 返回数组，至少包含主流合约 |
| 测试网/生产 | 两环境均执行 |

---

#### TC-MKT-10：edgex_get_ratio

| 项目 | 内容 |
|------|------|
| 目的 | 验证多交易所汇总的多空比 |
| 步骤 | 调用 `edgex_get_ratio`，`symbol`: `"BTC"`；再测不传 `symbol`（若支持） |
| 预期 | 返回含多空比或 long/short 相关字段，结构稳定 |
| 测试网/生产 | 两环境均执行 |

---

#### TC-MKT-11：edgex_get_summary

| 项目 | 内容 |
|------|------|
| 目的 | 验证全市场成交量/汇总数据 |
| 步骤 | 调用 `edgex_get_summary`，无参数 |
| 预期 | 返回市场级汇总（如总成交量、按合约统计等），结构稳定 |
| 测试网/生产 | 两环境均执行 |

---

### 3.2 账户类（需要认证）

以下用例需配置有效的 `EDGEX_ACCOUNT_ID` 与 `EDGEX_STARK_PRIVATE_KEY`（测试网或生产对应环境）。

#### TC-ACC-01：edgex_get_balances（有认证）

| 项目 | 内容 |
|------|------|
| 目的 | 验证余额与权益信息 |
| 前置 | 已配置该环境的账户凭证 |
| 步骤 | 调用 `edgex_get_balances`，无参数 |
| 预期 | 返回 account、collateralList、positionList、collateralAssetModelList 等；availableAmount、totalEquity 等为可解析数字字符串 |
| 测试网/生产 | 两环境均执行；测试网可用测试账户 |

#### TC-ACC-02：edgex_get_balances（无认证）

| 项目 | 内容 |
|------|------|
| 目的 | 验证未配置凭证时的错误 |
| 前置 | 临时去掉或错误配置凭证 |
| 步骤 | 调用 `edgex_get_balances` |
| 预期 | 返回明确错误（如 401 / 未授权），不暴露内部堆栈 |
| 测试网/生产 | 可选在一环境验证即可 |

---

#### TC-ACC-03：edgex_get_positions（无持仓）

| 项目 | 内容 |
|------|------|
| 目的 | 无持仓时返回空数组 |
| 步骤 | 在确认无持仓的账户上调用 `edgex_get_positions` |
| 预期 | 返回 `[]` 或 positionList 为空 |
| 测试网/生产 | 两环境均执行（可用无持仓账户） |

#### TC-ACC-04：edgex_get_positions（有持仓）

| 项目 | 内容 |
|------|------|
| 目的 | 有持仓时返回持仓与未实现盈亏 |
| 前置 | 账户存在至少一笔持仓（可先通过 place_order 在测试网造仓） |
| 步骤 | 调用 `edgex_get_positions` |
| 预期 | 返回含 size、entryPrice、unrealizedPnl、markPrice 等字段的持仓列表 |
| 测试网/生产 | 建议先在测试网验证；生产可选 |

---

#### TC-ACC-05：edgex_get_orders（无挂单 / 有挂单）

| 项目 | 内容 |
|------|------|
| 目的 | 验证当前挂单列表 |
| 步骤 | 1. 无挂单时调用，不传 symbol<br>2. 有挂单时调用；再传 `symbol`: `"BTC"` 过滤 |
| 预期 | 无挂单返回空数组；有挂单返回订单列表，含 orderId、symbol、side、size、price、status 等 |
| 测试网/生产 | 两环境均执行 |

#### TC-ACC-06：edgex_get_order_status

| 项目 | 内容 |
|------|------|
| 目的 | 按 orderId 查询单笔订单状态 |
| 前置 | 已知一个有效 orderId（可从 get_orders 取或刚下单得到） |
| 步骤 | 调用 `edgex_get_order_status`，`orderId`: 有效 ID |
| 预期 | 返回该订单的详细状态（status、filled、price 等） |
| 测试网/生产 | 两环境均执行 |

#### TC-ACC-07：edgex_get_order_status（无效 ID）

| 项目 | 内容 |
|------|------|
| 目的 | 无效 orderId 时的表现 |
| 步骤 | 调用 `edgex_get_order_status`，`orderId`: `"0"` 或不存在 ID |
| 预期 | 返回 404 或明确“未找到”类错误，不崩溃 |
| 测试网/生产 | 两环境均执行 |

---

#### TC-ACC-08：edgex_get_max_size

| 项目 | 内容 |
|------|------|
| 目的 | 验证在余额与杠杆下最大可买/可卖量 |
| 步骤 | 调用 `edgex_get_max_size`，`symbol`: `"BTC"`；再测 `"ETH"`、`"SOL"` |
| 预期 | 返回 maxBuySize、maxSellSize（字符串），以及 ask1Price、bid1Price；数值合理（≤ 账户可开规模） |
| 测试网/生产 | 两环境均执行 |

---

#### TC-ACC-09：edgex_set_leverage

| 项目 | 内容 |
|------|------|
| 目的 | 验证设置杠杆成功 |
| 步骤 | 1. 调用 `edgex_set_leverage`，`symbol`: `"SOL"`，`leverage`: `5`<br>2. 再查 get_balances 或 get_positions 相关配置确认杠杆已为 5（若接口暴露） |
| 预期 | 调用成功无报错；后续下单或持仓信息反映新杠杆（视 API 设计） |
| 测试网/生产 | **优先在测试网执行**；生产可择机执行并改回原杠杆 |

---

### 3.3 交易类（需要认证，写操作）

生产环境仅建议用**极小仓位/限价单**验证，避免市价单造成意外成交。

#### TC-TRD-01：edgex_place_order（限价单 — 不成交）

| 项目 | 内容 |
|------|------|
| 目的 | 下限价单，价格远离市价确保不立刻成交 |
| 前置 | 已查当前价（如 BTC ticker）；已查 max_size |
| 步骤 | 做空：`symbol`: `"SOL"`，`side`: `"sell"`，`type`: `"limit"`，`size`: 该合约**最小下单量**（如 0.3），`price`: 当前价 * 1.05（上方 5%） |
| 预期 | 返回 orderId；get_orders 可查到该订单；get_order_status(orderId) 状态为 pending/open 类 |
| 测试网/生产 | **先在测试网**；生产若执行用最小 size 且价格设明显偏离 |

#### TC-TRD-02：edgex_place_order（参数校验 — 低于最小量）

| 项目 | 内容 |
|------|------|
| 目的 | 验证低于最小下单量时接口报错 |
| 步骤 | 例如 SOL：`size`: `"0.01"`，limit 价格合理 |
| 预期 | 返回明确错误，如 “order size exceed min order size 0.3” 或类似，不产生订单 |
| 测试网/生产 | 两环境均执行（不实际成交） |

#### TC-TRD-03：edgex_place_order（缺少 price）

| 项目 | 内容 |
|------|------|
| 目的 | limit 单缺少 price 时应报错 |
| 步骤 | `type`: `"limit"`，不传 `price` |
| 预期 | 参数校验错误，不提交到交易所 |
| 测试网/生产 | 两环境均执行 |

#### TC-TRD-04：edgex_place_order（市价单 — 仅测试网建议）

| 项目 | 内容 |
|------|------|
| 目的 | 验证市价单参数与返回（测试网可接受即时成交） |
| 步骤 | 测试网：极小 size 市价单 buy，随后用限价单或市价单平掉 |
| 预期 | 返回 orderId，订单迅速 filled；get_positions 短暂体现持仓后平仓消失 |
| 测试网/生产 | **仅测试网**；生产不执行市价单用例以免滑点 |

---

#### TC-TRD-05：edgex_cancel_order

| 项目 | 内容 |
|------|------|
| 目的 | 撤销单笔挂单 |
| 前置 | 存在一笔未成交限价单（可由 TC-TRD-01 产生） |
| 步骤 | 调用 `edgex_cancel_order`，`orderIds`: `[ 该 orderId ]` |
| 预期 | 撤销成功；get_orders 中该订单消失或状态为 cancelled |
| 测试网/生产 | **先在测试网**；生产用测试单验证后撤销 |

#### TC-TRD-06：edgex_cancel_order（无效 ID）

| 项目 | 内容 |
|------|------|
| 目的 | 撤销不存在的订单时的表现 |
| 步骤 | `orderIds`: `[ "999999999999" ]` |
| 预期 | 返回错误提示（如订单不存在或已撤销），不崩溃 |
| 测试网/生产 | 两环境均执行 |

---

#### TC-TRD-07：edgex_cancel_all_orders（按 symbol）

| 项目 | 内容 |
|------|------|
| 目的 | 撤销某标的全部挂单 |
| 前置 | 该标的有至少一笔挂单 |
| 步骤 | 调用 `edgex_cancel_all_orders`，`symbol`: `"SOL"` |
| 预期 | 该标的挂单全部撤销；get_orders(symbol) 为空或不再含 SOL 订单 |
| 测试网/生产 | **优先测试网**；生产慎用 |

#### TC-TRD-08：edgex_cancel_all_orders（全撤）

| 项目 | 内容 |
|------|------|
| 目的 | 不传 symbol 时撤销所有挂单 |
| 前置 | 存在多标的挂单 |
| 步骤 | 调用 `edgex_cancel_all_orders`，不传 `symbol` |
| 预期 | 所有挂单被撤销；get_orders 返回空 |
| 测试网/生产 | **仅测试网建议**；生产仅在确认无重要挂单时执行 |

---

### 3.4 环境与配置

#### TC-CFG-01：测试网 / 生产 Base URL 隔离

| 项目 | 内容 |
|------|------|
| 目的 | 确认 EDGEX_TESTNET 正确切换 API |
| 步骤 | 1. 设置 `EDGEX_TESTNET=1`，调用 get_ticker("BTC")，记录返回的 lastPrice 或任意特征<br>2. 设置 `EDGEX_TESTNET=0` 或未设置，再次 get_ticker("BTC")<br>3. 对比两次请求的 base URL 或响应（测试网与生产价格可能不同） |
| 预期 | 测试网请求发往 testnet.edgex.exchange；生产发往 pro.edgex.exchange；响应结构一致 |
| 测试网/生产 | 通过两次配置分别验证 |

#### TC-CFG-02：EDGEX_BASE_URL 覆盖

| 项目 | 内容 |
|------|------|
| 目的 | 显式覆盖 base URL 时使用自定义地址 |
| 步骤 | 设置 `EDGEX_BASE_URL=https://testnet.edgex.exchange`，不设 TESTNET，调用 get_ticker("BTC") |
| 预期 | 请求发往指定 BASE_URL，能正常返回数据（若该 URL 有效） |
| 测试网/生产 | 可选 |

---

### 3.5 美股合约（若支持）

| 用例 ID | 描述 | 步骤概要 | 预期 |
|---------|------|----------|------|
| TC-EQ-01 | 美股标的行情 | get_ticker("TSLA") 或 "AAPL" | 返回该合约行情，注意交易时段与涨跌停规则 |
| TC-EQ-02 | 非交易时段限价单 | 美股休市时 place_order limit TSLA | 按 trading-rules：仅限价单、且在允许价格范围内；市价单应被拒绝 |
| TC-EQ-03 | 深度/资金费率 | get_depth、get_funding 美股标的 | 返回结构一致，数据可为 0 或占位 |

---

## 四、执行顺序建议

1. **仅行情**：TC-MKT-01～TC-MKT-11（无需认证，先跑通）
2. **账户只读**：TC-ACC-01～TC-ACC-08（需认证）
3. **设置杠杆**：TC-ACC-09（测试网优先）
4. **下单与撤单**：TC-TRD-01～TC-TRD-08（测试网完整跑；生产仅限价、最小量、并立刻撤单）
5. **配置与美股**：TC-CFG-01～TC-CFG-02、TC-EQ-01～TC-EQ-03

---

## 五、结果记录模板

建议按环境与用例记录为表格，便于回归对比：

| 环境 | 用例 ID | 结果 (PASS/FAIL/SKIP) | 备注（错误信息或异常） |
|------|---------|------------------------|------------------------|
| 测试网 | TC-MKT-01 | | |
| 测试网 | TC-MKT-02 | | |
| … | | | |
| 生产 | TC-MKT-01 | | |
| … | | | |

---

## 六、通过标准

- **通过**：所有 P0 用例在测试网与生产均为 PASS；写操作在生产为 SKIP 或极小量验证通过。  
- **阻塞**：任一环境上 get_ticker / get_balances（有认证）失败，或 place_order 在测试网无法完成完整流程，视为阻塞。  
- **已知差异**：测试网与生产数据（价格、深度、订单簿）可不同；测试网撮合/延迟可能与生产不一致，仅需保证接口行为与错误语义一致。

---

*文档版本：1.0 | 适用于 EdgeX MCP Server（@realnaka/edgex-mcp）*
