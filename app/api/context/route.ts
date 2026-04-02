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
  try {
    const [btc24h, ethbtc] = await Promise.allSettled([
      safeJson('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
      safeJson('https://api.binance.com/api/v3/ticker/price?symbol=ETHBTC'),
    ]);

    const btcChange =
      btc24h.status === 'fulfilled' && btc24h.value?.priceChangePercent
        ? `${Number(btc24h.value.priceChangePercent).toFixed(2)}%`
        : 'Unavailable';

    const ethbtcValue =
      ethbtc.status === 'fulfilled' && ethbtc.value?.price
        ? Number(ethbtc.value.price).toFixed(5)
        : 'Unavailable';

    return NextResponse.json({
      dxy: 'Context disabled',
      spy: btcChange,
      ethbtc: ethbtcValue,
    });
  } catch (error) {
    return NextResponse.json({
      dxy: 'Unavailable',
      spy: 'Unavailable',
      ethbtc: 'Unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}