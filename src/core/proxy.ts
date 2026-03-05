import { ProxyAgent } from 'undici';

let dispatcher: ProxyAgent | undefined;
let proxyUrl: string | null = null;

export function setupProxy(): void {
  const url = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!url) return;

  try {
    dispatcher = new ProxyAgent(url);
    proxyUrl = url;
    process.stderr.write(`[edgex-mcp] Proxy configured: ${url}\n`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[edgex-mcp] Failed to configure proxy (${url}): ${msg}\n`);
  }
}

export function getDispatcher(): ProxyAgent | undefined {
  return dispatcher;
}

export function getActiveProxy(): string | null {
  return proxyUrl;
}
