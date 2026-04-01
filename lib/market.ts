import { Candle, DashboardState, Timeframe, Bias } from '@/lib/types';

export const FALLBACK_CANDLES: Record<Timeframe, Candle[]> = {
  '15m': Array.from({ length: 80 }, (_, i) => {
    const base = 66700 + Math.sin(i / 5) * 140 + i * 1.5;
    return { time: Date.now() - (80 - i) * 15 * 60 * 1000, open: base - 22, high: base + 38, low: base - 45, close: base + Math.sin(i) * 15, volume: 120 + i * 3 };
  }),
  '1h': Array.from({ length: 80 }, (_, i) => {
    const base = 66850 + Math.sin(i / 7) * 320 - i * 1.2;
    return { time: Date.now() - (80 - i) * 60 * 60 * 1000, open: base - 35, high: base + 70, low: base - 90, close: base + Math.cos(i) * 28, volume: 500 + i * 8 };
  }),
  '4h': Array.from({ length: 80 }, (_, i) => {
    const base = 67200 - i * 11 + Math.sin(i / 6) * 500;
    return { time: Date.now() - (80 - i) * 4 * 60 * 60 * 1000, open: base - 65, high: base + 120, low: base - 140, close: base + Math.cos(i / 2) * 44, volume: 1200 + i * 16 };
  }),
  '1d': Array.from({ length: 80 }, (_, i) => {
    const base = 68900 - i * 30 + Math.sin(i / 8) * 900;
    return { time: Date.now() - (80 - i) * 24 * 60 * 60 * 1000, open: base - 110, high: base + 220, low: base - 260, close: base + Math.cos(i / 3) * 80, volume: 4800 + i * 30 };
  }),
};

export function fmt(n?: number, digits = 2) {
  return typeof n === 'number' && Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
    : '—';
}

export function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  let prev = values[0] ?? 0;
  return values.map((v, i) => {
    if (i === 0) return prev;
    prev = v * k + prev * (1 - k);
    return prev;
  });
}

export function rsi(values: number[], period = 14) {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const gain = Math.max(d, 0);
    const loss = Math.max(-d, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function buildStateFromCandles(candles: Candle[], sourceTime: string, context?: { dxy?: string; spy?: string; ethbtc?: string }): DashboardState {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const last = candles[candles.length - 1];
  const first = candles[Math.max(0, candles.length - 25)];
  const e21 = ema(closes, 21);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, Math.max(2, Math.min(200, closes.length - 1)));
  const latestRsi = rsi(closes);
  const swingHigh = Math.max(...highs.slice(-20));
  const swingLow = Math.min(...lows.slice(-20));
  const structure = last.close > e21[e21.length - 1] && e21[e21.length - 1] > e50[e50.length - 1]
    ? 'HH / HL'
    : last.close < e21[e21.length - 1] && e21[e21.length - 1] < e50[e50.length - 1]
      ? 'LH / LL'
      : 'Range';
  const bias: Bias = structure === 'HH / HL' ? 'bullish' : structure === 'LH / LL' ? 'bearish' : 'neutral';
  const support1 = Math.min(...lows.slice(-12));
  const support2 = Math.min(...lows.slice(-30, -12));
  const resistance1 = Math.max(...highs.slice(-12));
  const resistance2 = Math.max(...highs.slice(-30, -12));
  const longEntry: [number, number] = [support1 * 1.002, support1 * 1.006];
  const longStop = support1 * 0.992;
  const longTargets = [last.close * 1.01, resistance1 * 0.995, resistance2 * 0.995]
    .filter((x, i, arr) => x > longEntry[1] && arr.indexOf(x) === i)
    .sort((a, b) => a - b);
  const shortEntry: [number, number] = [resistance1 * 0.994, resistance1 * 0.998];
  const shortStop = resistance1 * 1.009;
  const shortTargets = [last.close * 0.99, support1 * 1.003, support2 * 1.004]
    .filter((x, i, arr) => x < shortEntry[0] && arr.indexOf(x) === i)
    .sort((a, b) => b - a);
  const change24h = ((last.close - first.close) / first.close) * 100;
  const macdState = e21[e21.length - 1] > e50[e50.length - 1] ? 'Bullish crossover bias' : 'Bearish crossover bias';

  return {
    price: last.close,
    change24h,
    high24h: Math.max(...highs.slice(-24)),
    low24h: Math.min(...lows.slice(-24)),
    volume24h: volumes.slice(-24).reduce((a, b) => a + b, 0),
    updatedAt: sourceTime,
    bias,
    confidence: bias === 'neutral' ? 'low' : 'medium',
    structure,
    swingHigh,
    swingLow,
    rsi: latestRsi,
    ema21: e21[e21.length - 1],
    ema50: e50[e50.length - 1],
    ema200: e200[e200.length - 1],
    macdState,
    supports: [support1, support2].filter(Number.isFinite),
    resistances: [resistance1, resistance2].filter(Number.isFinite),
    longEntry,
    longStop,
    longTargets: longTargets.length ? longTargets : [last.close * 1.01, last.close * 1.02],
    shortEntry,
    shortStop,
    shortTargets: shortTargets.length ? shortTargets : [last.close * 0.99, last.close * 0.98],
    dxy: context?.dxy ?? 'Fallback macro context',
    spy: context?.spy ?? 'Fallback macro context',
    ethbtc: context?.ethbtc ?? 'Fallback ratio context',
    candles,
    signals: [
      {
        title: bias === 'bullish' ? 'Confirmed Long' : 'Breakout Watch',
        direction: bias === 'bullish' ? 'bullish' : 'neutral',
        trigger: `Reclaim above ${fmt(resistance1, 0)}`,
        note: 'Enter only on hold above local resistance with momentum confirmation.',
        invalidation: `Back below ${fmt(e21[e21.length - 1], 0)}`,
        risk: 'Avoid if DXY is strong and BTC loses EMA21 on the selected timeframe.',
      },
      {
        title: bias === 'bearish' ? 'Confirmed Short' : 'Liquidity Sweep Watch',
        direction: bias === 'bearish' ? 'bearish' : 'neutral',
        trigger: `Reject near ${fmt(resistance1, 0)}-${fmt(resistance1 * 1.002, 0)}`,
        note: 'Prefer entries after failed reclaim and weak close back under the zone.',
        invalidation: `4H close above ${fmt(shortStop, 0)}`,
        risk: 'Do not short directly into support when R:R is compressed.',
      },
    ],
  };
}
