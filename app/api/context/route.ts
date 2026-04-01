import { NextResponse } from 'next/server';

async function safeText(url: string, parser: (json: any) => string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store', next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return parser(json);
}

export async function GET() {
  const [dxy, spy, ethbtc] = await Promise.allSettled([
    safeText('https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=abcdefghijklmnopqrstuvwxyz123456&file_type=json', (json) => json?.observations?.at?.(-1)?.value ? `Index ${json.observations.at(-1).value}` : 'Unavailable'),
    safeText('https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=5d', (json) => {
      const close = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter((x: number) => Number.isFinite(x)) ?? [];
      const last = close.at(-1); const prev = close.at(-2);
      return Number.isFinite(last) && Number.isFinite(prev) ? `${last.toFixed(2)} (${(((last - prev) / prev) * 100).toFixed(2)}%)` : 'Unavailable';
    }),
    safeText('https://api.binance.com/api/v3/ticker/price?symbol=ETHBTC', (json) => json?.price ? Number(json.price).toFixed(5) : 'Unavailable')
  ]);

  return NextResponse.json({
    dxy: dxy.status === 'fulfilled' ? dxy.value : 'Unavailable',
    spy: spy.status === 'fulfilled' ? spy.value : 'Unavailable',
    ethbtc: ethbtc.status === 'fulfilled' ? ethbtc.value : 'Unavailable'
  });
}
