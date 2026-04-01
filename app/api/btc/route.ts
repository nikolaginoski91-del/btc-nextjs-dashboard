import { NextRequest, NextResponse } from 'next/server';
import { Candle, Timeframe } from '@/lib/types';

const TF_MAP: Record<Timeframe, string> = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store', next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchBinance(tf: string): Promise<Candle[]> {
  const raw = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${tf}&limit=200`);
  return raw.map((k: string[]) => ({
    time: Number(k[0]), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5])
  }));
}

async function fetchCoinGeckoDaily(): Promise<Candle[]> {
  const raw = await fetchJson('https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=30');
  return raw.map((k: number[]) => ({ time: k[0], open: k[1], high: k[2], low: k[3], close: k[4], volume: 0 }));
}

export async function GET(req: NextRequest) {
  const tfParam = (req.nextUrl.searchParams.get('tf') || '4h') as Timeframe;
  const tf = TF_MAP[tfParam] || '4h';
  try {
    const candles = await fetchBinance(tf);
    return NextResponse.json({ source: 'binance', candles });
  } catch (error) {
    if (tf === '1d') {
      try {
        const candles = await fetchCoinGeckoDaily();
        return NextResponse.json({ source: 'coingecko', candles });
      } catch {}
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown btc route error' }, { status: 502 });
  }
}
