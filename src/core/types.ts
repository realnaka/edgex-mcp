// ─── Configuration ───

export interface EdgexConfig {
  accountId?: string;
  starkPrivateKey?: string;
  baseUrl: string;
  wsUrl: string;
}

// ─── API Response Envelope ───

export interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

// ─── Metadata ───

export interface ContractMeta {
  contractId: string;
  contractName: string;
  tickSize: string;
  stepSize: string;
  defaultLeverage: string;
  maxLeverage: string;
  minOrderSize: string;
  maxOrderSize: string;
  displayName?: string;
  quoteCoinId?: string;
  starkExSyntheticAssetId?: string;
  starkExResolution?: string;
  defaultTakerFeeRate?: string;
  defaultMakerFeeRate?: string;
}

export interface CoinMeta {
  coinId: string;
  coinName: string;
  stepSize: string;
  starkExAssetId?: string;
  starkExResolution?: string;
}

export interface MetaData {
  contractList: ContractMeta[];
  serverTime: string;
  global: Record<string, unknown>;
}

// ─── Quote / Market ───

export interface Ticker {
  contractId: string;
  contractName: string;
  lastPrice: string;
  oraclePrice: string;
  markPrice: string;
  indexPrice: string;
  priceChange: string;
  priceChangePercent: string;
  high: string;
  low: string;
  open: string;
  close: string;
  size: string;
  value: string;
  trades: string;
  openInterest: string;
  fundingRate: string;
}

export interface DepthLevel {
  price: string;
  size: string;
}

export interface Depth {
  contractId: string;
  asks: DepthLevel[];
  bids: DepthLevel[];
  timestamp: string;
}

export interface KlineResponse {
  dataList: KlineBar[];
  nextPageOffsetData: string;
}

export interface KlineBar {
  klineId: string;
  contractId: string;
  contractName: string;
  klineType: string;
  klineTime: string;
  open: string;
  close: string;
  high: string;
  low: string;
  size: string;
  value: string;
  trades: string;
  [key: string]: string;
}

export interface FundingRate {
  contractId: string;
  contractName: string;
  fundingRate: string;
  fundingTimestamp: string;
  nextFundingTime?: string;
}

export interface TickerSummary {
  totalVolume24h: string;
  totalOpenInterest: string;
  totalTrades24h: string;
}

export interface LongShortRatioResponse {
  exchangeLongShortRatioList: LongShortRatio[];
}

export interface LongShortRatio {
  range: string;
  contractId: string;
  exchange: string;
  buyRatio: string;
  sellRatio: string;
  buyVolUsd: string;
  sellVolUsd: string;
}

// ─── Kline interval mapping ───

export const KLINE_INTERVALS: Record<string, string> = {
  '1m':  'MINUTE_1',
  '5m':  'MINUTE_5',
  '15m': 'MINUTE_15',
  '30m': 'MINUTE_30',
  '1h':  'HOUR_1',
  '2h':  'HOUR_2',
  '4h':  'HOUR_4',
  '6h':  'HOUR_6',
  '8h':  'HOUR_8',
  '12h': 'HOUR_12',
  '1d':  'DAY_1',
  '1w':  'WEEK_1',
  '1M':  'MONTH_1',
};

// ─── Account ───

export interface AccountAsset {
  accountId: string;
  totalEquity: string;
  availableBalance: string;
  initialMargin: string;
  maintenanceMargin: string;
  unrealizedPnl: string;
  positionList: Position[];
}

export interface Position {
  contractId: string;
  contractName: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  unrealizedPnl: string;
  leverage: string;
}

// ─── Orders ───

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET';

export interface Order {
  orderId: string;
  clientOrderId: string;
  contractId: string;
  contractName: string;
  side: OrderSide;
  type: OrderType;
  price: string;
  size: string;
  filledSize: string;
  status: string;
  createdTime: string;
  updatedTime: string;
}

export interface CreateOrderParams {
  contractId: string;
  side: OrderSide;
  type: OrderType;
  size: string;
  price?: string;
  clientOrderId?: string;
  isSetOpenTp?: boolean;
  isSetOpenSl?: boolean;
  openTp?: { side: OrderSide; price: string; size: string };
  openSl?: { side: OrderSide; price: string; size: string };
}

// ─── Output format ───

export type OutputFormat = 'human' | 'json';
