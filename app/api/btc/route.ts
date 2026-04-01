import { NextResponse } from "next/server";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const TF_TO_SECONDS: Record<string, number> = {
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function fetchCoinbaseCandles(tf: string): Promise<Candle[]> {
  const granularity = TF_TO_SECONDS[tf] ?? 14400;

  const end = new Date();
  const start = new Date(end.getTime() - granularity * 200 * 1000);

  const url =
    `https://api.exchange.coinbase.com/products/BTC-USD/candles` +
    `?granularity=${granularity}` +
    `&start=${start.toISOString()}` +
    `&end=${end.toISOString()}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "btc-dashboard",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Coinbase HTTP ${res.status}`);
  }

  const raw = await res.json();

  if (!Array.isArray(raw) || !raw.length) {
    throw new Error("Coinbase returned no candles");
  }

  const candles: Candle[] = raw
    .map((row: number[]) => ({
      time: row[0] * 1000,
      low: Number(row[1]),
      high: Number(row[2]),
      open: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .sort((a, b) => a.time - b.time);

  return candles;
}

async function fetchKrakenCandles(tf: string): Promise<Candle[]> {
  const intervalMap: Record<string, number> = {
    "15m": 15,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
  };

  const interval = intervalMap[tf] ?? 240;
  const url = `https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=${interval}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "btc-dashboard",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Kraken HTTP ${res.status}`);
  }

  const raw = await res.json();

  if (!raw?.result) {
    throw new Error("Kraken returned invalid data");
  }

  const key = Object.keys(raw.result).find((k) => k !== "last");
  if (!key || !Array.isArray(raw.result[key])) {
    throw new Error("Kraken returned no candles");
  }

  const candles: Candle[] = raw.result[key]
    .map((row: string[]) => ({
      time: Number(row[0]) * 1000,
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[6]),
    }))
    .sort((a: Candle, b: Candle) => a.time - b.time);

  return candles;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tf = searchParams.get("tf") || "4h";

  try {
    const candles = await fetchCoinbaseCandles(tf);
    return json({
      source: "coinbase",
      candles,
    });
  } catch (coinbaseError) {
    try {
      const candles = await fetchKrakenCandles(tf);
      return json({
        source: "kraken",
        candles,
      });
    } catch (krakenError) {
      return json(
        {
          error: "All BTC sources failed",
          details: {
            coinbase: coinbaseError instanceof Error ? coinbaseError.message : String(coinbaseError),
            kraken: krakenError instanceof Error ? krakenError.message : String(krakenError),
          },
        },
        500
      );
    }
  }
}