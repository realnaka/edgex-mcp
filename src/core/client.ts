import type {
  ApiResponse,
  ContractMeta,
  CoinMeta,
  Ticker,
  Depth,
  KlineResponse,
  FundingRate,
  LongShortRatioResponse,
  AccountAsset,
  Order,
  EdgexConfig,
} from './types.js';
import { rateLimit } from './rate-limiter.js';
import { signRequest } from './auth.js';
import { ApiError, ConfigError } from '../utils/errors.js';

export class EdgexClient {
  private baseUrl: string;
  private accountId?: string;
  private starkPrivateKey?: string;

  constructor(config: EdgexConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accountId = config.accountId;
    this.starkPrivateKey = config.starkPrivateKey;
  }

  private requireAuth(): void {
    if (!this.accountId || !this.starkPrivateKey) {
      throw new ConfigError(
        'Authentication required. Run "edgex setup" or set EDGEX_ACCOUNT_ID and EDGEX_STARK_PRIVATE_KEY.',
      );
    }
  }

  // ─── Public request (no auth) ───

  private async request<T>(method: string, path: string, params?: Record<string, string>): Promise<T> {
    await rateLimit();

    let url = `${this.baseUrl}${path}`;
    if (params && method === 'GET') {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += `?${qs}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' && params ? { body: JSON.stringify(params) } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ApiError('NETWORK', `Failed to connect to ${this.baseUrl} — ${msg}`);
    }

    if (!res.ok) {
      throw new ApiError(String(res.status), `HTTP ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== '0' && json.code !== 'SUCCESS') {
      throw new ApiError(json.code, json.msg || 'Unknown API error');
    }

    return json.data;
  }

  // ─── Authenticated request ───

  private async authRequest<T>(
    method: string,
    path: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    this.requireAuth();
    await rateLimit();

    const { timestamp, signature } = signRequest(
      method,
      path,
      this.starkPrivateKey!,
      params,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-edgeX-Api-Timestamp': timestamp,
      'X-edgeX-Api-Signature': signature,
    };

    let url = `${this.baseUrl}${path}`;
    const init: RequestInit = { method, headers };

    if (method === 'GET' && params && Object.keys(params).length > 0) {
      const qs = Object.keys(params)
        .sort()
        .map(k => `${k}=${encodeURIComponent(String(params[k]))}`)
        .join('&');
      url += `?${qs}`;
    } else if (method === 'POST' && params) {
      init.body = JSON.stringify(params);
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ApiError('NETWORK', `Failed to connect to ${this.baseUrl} — ${msg}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(String(res.status), `HTTP ${res.status}: ${res.statusText} ${text}`);
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== '0' && json.code !== 'SUCCESS') {
      throw new ApiError(json.code, json.msg || 'Unknown API error');
    }

    return json.data;
  }

  get currentAccountId(): string | undefined {
    return this.accountId;
  }

  // ─── Public: Metadata ───

  async getMetaData(): Promise<{ contractList: ContractMeta[]; coinList: CoinMeta[] }> {
    return this.request('GET', '/api/v1/public/meta/getMetaData');
  }

  async getServerTime(): Promise<{ serverTime: string }> {
    return this.request('GET', '/api/v1/public/meta/getServerTime');
  }

  // ─── Public: Quote ───

  async getTicker(contractId?: string): Promise<Ticker[]> {
    const params: Record<string, string> = {};
    if (contractId) params.contractId = contractId;
    return this.request('GET', '/api/v1/public/quote/getTicker', params);
  }

  async getDepth(contractId: string, level: string = '15'): Promise<Depth> {
    const data = await this.request<Depth[]>('GET', '/api/v1/public/quote/getDepth', {
      contractId,
      level,
    });
    return Array.isArray(data) ? data[0]! : data;
  }

  async getKline(contractId: string, klineType: string, size: string = '100'): Promise<KlineResponse> {
    return this.request('GET', '/api/v1/public/quote/getKline', {
      contractId,
      klineType,
      size,
      priceType: 'LAST_PRICE',
    });
  }

  async getTickerSummary(): Promise<unknown> {
    return this.request('GET', '/api/v1/public/quote/getTicketSummary');
  }

  async getLongShortRatio(contractId?: string): Promise<LongShortRatioResponse> {
    const params: Record<string, string> = {};
    if (contractId) params.contractId = contractId;
    return this.request('GET', '/api/v1/public/quote/getExchangeLongShortRatio', params);
  }

  // ─── Public: Funding ───

  async getLatestFundingRate(contractId?: string): Promise<FundingRate[]> {
    const params: Record<string, string> = {};
    if (contractId) params.contractId = contractId;
    return this.request('GET', '/api/v1/public/funding/getLatestFundingRate', params);
  }

  async getFundingRatePage(contractId: string, page: string = '1', limit: string = '20'): Promise<unknown> {
    return this.request('GET', '/api/v1/public/funding/getFundingRatePage', {
      contractId,
      page,
      limit,
    });
  }

  // ─── Private: Account ───

  async getAccountAsset(): Promise<AccountAsset> {
    return this.authRequest('GET', '/api/v1/private/account/getAccountAsset', {
      accountId: this.accountId!,
    });
  }

  async getAccountById(): Promise<unknown> {
    return this.authRequest('GET', '/api/v1/private/account/getAccountById', {
      accountId: this.accountId!,
    });
  }

  async updateLeverageSetting(contractId: string, leverage: string): Promise<unknown> {
    return this.authRequest('POST', '/api/v1/private/account/updateLeverageSetting', {
      accountId: this.accountId!,
      contractId,
      leverage,
    });
  }

  // ─── Private: Orders ───

  async getActiveOrders(
    contractId?: string,
    size: string = '50',
  ): Promise<{ dataList: Order[]; nextPageOffsetData: string }> {
    const params: Record<string, unknown> = {
      accountId: this.accountId!,
      size,
    };
    if (contractId) params.contractId = contractId;
    return this.authRequest('GET', '/api/v1/private/order/getActiveOrderPage', params);
  }

  async getOrderById(orderId: string): Promise<Order> {
    return this.authRequest('GET', '/api/v1/private/order/getOrderById', {
      accountId: this.accountId!,
      orderId,
    });
  }

  async getOrderByClientOrderId(clientOrderId: string): Promise<Order> {
    return this.authRequest('GET', '/api/v1/private/order/getOrderByClientOrderId', {
      accountId: this.accountId!,
      clientOrderId,
    });
  }

  async cancelOrderById(orderIds: string[]): Promise<unknown> {
    return this.authRequest('POST', '/api/v1/private/order/cancelOrderById', {
      accountId: this.accountId!,
      orderIdList: orderIds,
    });
  }

  async cancelAllOrder(contractId?: string): Promise<unknown> {
    const params: Record<string, unknown> = {
      accountId: this.accountId!,
    };
    if (contractId) params.contractId = contractId;
    return this.authRequest('POST', '/api/v1/private/order/cancelAllOrder', params);
  }

  async createOrder(orderParams: Record<string, unknown>): Promise<unknown> {
    return this.authRequest('POST', '/api/v1/private/order/createOrder', {
      ...orderParams,
      accountId: this.accountId!,
    });
  }

  async getMaxCreateOrderSize(contractId: string, price?: string): Promise<unknown> {
    const params: Record<string, unknown> = {
      accountId: this.accountId!,
      contractId,
    };
    if (price) params.price = price;
    return this.authRequest('POST', '/api/v1/private/order/getMaxCreateOrderSize', params);
  }
}
