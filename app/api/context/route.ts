import { NextResponse } from 'next/server';

async function safeJson(url: string) {
  const res = await fetch(url, {
    cache: 'no-store',
    next: { revalidate: 0 },
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

export async function GET() {
  const [btc24h, ethusd] = await Promise.allSettled([
    safeJson('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
    safeJson('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
  ]);

  const spy =
    btc24h.status === 'fulfilled' && btc24h.value?.priceChangePercent
      ? `${Number(btc24h.value.priceChangePercent).toFixed(2)}%`
      : 'Unavailable';

  const ethbtc =
    ethusd.status === 'fulfilled' && ethusd.value?.price
      ? `$${Number(ethusd.value.price).toFixed(2)}`
      : 'Unavailable';

  return NextResponse.json({
    dxy: 'Context disabled',
    spy,
    ethbtc,
  });
}