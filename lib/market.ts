import { Candle, DashboardState, Bias, SignalCard, SignalStrength, Timeframe, ExecutionState } from './types';

export function fmt(n?: number, digits = 2) {
  return typeof n === 'number' && Number.isFinite(n)
    ? n.toLocaleString(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
    : '—';
}

export const FALLBACK_CANDLES: Record<Timeframe, Candle[]> = {
  '15m': Array.from({ length: 120 }, (_, i) => {
    const base = 66700 + Math.sin(i / 5) * 140 + i * 1.2;
    return {
      time: Date.now() - (120 - i) * 15 * 60 * 1000,
      open: base - 18,
      high: base + 36,
      low: base - 42,
      close: base + Math.sin(i) * 12,
      volume: 120 + i * 2,
    };
  }),
  '1h': Array.from({ length: 120 }, (_, i) => {
    const base = 66850 + Math.sin(i / 7) * 320 - i * 0.9;
    return {
      time: Date.now() - (120 - i) * 60 * 60 * 1000,
      open: base - 32,
      high: base + 68,
      low: base - 82,
      close: base + Math.cos(i) * 22,
      volume: 520 + i * 6,
    };
  }),
  '4h': Array.from({ length: 120 }, (_, i) => {
    const base = 67200 - i * 9 + Math.sin(i / 6) * 480;
    return {
      time: Date.now() - (120 - i) * 4 * 60 * 60 * 1000,
      open: base - 58,
      high: base + 118,
      low: base - 134,
      close: base + Math.cos(i / 2) * 40,
      volume: 1200 + i * 14,
    };
  }),
  '1d': Array.from({ length: 120 }, (_, i) => {
    const base = 68900 - i * 28 + Math.sin(i / 8) * 880;
    return {
      time: Date.now() - (120 - i) * 24 * 60 * 60 * 1000,
      open: base - 105,
      high: base + 220,
      low: base - 250,
      close: base + Math.cos(i / 3) * 78,
      volume: 4800 + i * 28,
    };
  }),
};

export function ema(values: number[], period: number) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  let prev = values[0];
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

function uniqueSorted(values: number[], dir: 'asc' | 'desc' = 'asc') {
  const unique = Array.from(new Set(values.filter((x) => Number.isFinite(x)).map((x) => Number(x.toFixed(2)))));
  return unique.sort((a, b) => (dir === 'asc' ? a - b : b - a));
}

function latestSwingHigh(candles: Candle[], lookback = 20) {
  return Math.max(...candles.slice(-lookback).map((c) => c.high));
}

function latestSwingLow(candles: Candle[], lookback = 20) {
  return Math.min(...candles.slice(-lookback).map((c) => c.low));
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildSignals(params: {
  price: number;
  bias: Bias;
  trendState: 'uptrend' | 'downtrend' | 'range';
  rsi: number;
  ema21: number;
  ema50: number;
  ema200: number;
  support1: number;
  support2: number;
  resistance1: number;
  resistance2: number;
  longEntry: [number, number];
  longStop: number;
  longTargets: number[];
  shortEntry: [number, number];
  shortStop: number;
  shortTargets: number[];
}) {
  const {
    price,
    trendState,
    rsi,
    ema21,
    ema50,
    ema200,
    support1,
    support2,
    resistance1,
    resistance2,
    longEntry,
    longStop,
    longTargets,
    shortEntry,
    shortStop,
    shortTargets,
  } = params;

  const signals: SignalCard[] = [];

  const above21 = price > ema21;
  const above50 = price > ema50;
  const below21 = price < ema21;
  const below50 = price < ema50;

  const bullishStack = ema21 > ema50 && ema50 > ema200;
  const bearishStack = ema21 < ema50 && ema50 < ema200;

  const nearSupport = Math.abs(price - support1) / price < 0.01;
  const nearResistance = Math.abs(price - resistance1) / price < 0.01;

  const longRR =
    ((longTargets[1] ?? longTargets[0]) - longEntry[1]) / Math.max(longEntry[1] - longStop, 1);

  const shortRR =
    (shortEntry[0] - (shortTargets[1] ?? shortTargets[0])) / Math.max(shortStop - shortEntry[0], 1);

  const add = (
    title: string,
    direction: Bias,
    type: SignalCard['type'],
    strength: SignalStrength,
    trigger: string,
    note: string,
    invalidation: string,
    risk: string
  ) => {
    signals.push({ title, direction, type, strength, trigger, note, invalidation, risk });
  };

  if (bullishStack && above21 && above50 && rsi >= 54 && trendState === 'uptrend' && longRR >= 2) {
    add(
      'Confirmed Long',
      'bullish',
      'confirmed-long',
      'high',
      `Hold above ${fmt(ema21, 0)} and reclaim/push through ${fmt(resistance1, 0)}`,
      'Trend, momentum, and structure align. Prefer continuation entries on shallow pullbacks or breakout holds.',
      `Lose ${fmt(ema50, 0)} or close below ${fmt(longStop, 0)}`,
      'Avoid chasing directly into the second resistance if candle expansion is already extended.'
    );
  } else if ((nearSupport || price <= longEntry[1]) && rsi >= 46 && !bearishStack && longRR >= 2) {
    add(
      'Aggressive Long',
      'bullish',
      'aggressive-long',
      'medium',
      `Reaction from ${fmt(longEntry[0], 0)}-${fmt(longEntry[1], 0)}`,
      'This is a support-based entry, not full trend confirmation. Best used when downside momentum weakens near demand.',
      `Break below ${fmt(longStop, 0)}`,
      'This setup has less confirmation than a true trend continuation long.'
    );
  }

  if (bearishStack && below21 && below50 && rsi <= 46 && trendState === 'downtrend' && shortRR >= 2) {
    add(
      'Confirmed Short',
      'bearish',
      'confirmed-short',
      'high',
      `Reject below ${fmt(ema21, 0)} and fail near ${fmt(shortEntry[0], 0)}-${fmt(shortEntry[1], 0)}`,
      'Trend, momentum, and structure align bearish. Prefer failed reclaim setups instead of shorting deep into support.',
      `4H reclaim above ${fmt(shortStop, 0)}`,
      'Do not press the short if price is already sitting on the primary support shelf.'
    );
  } else if ((nearResistance || price >= shortEntry[0]) && rsi <= 54 && !bullishStack && shortRR >= 2) {
    add(
      'Aggressive Short',
      'bearish',
      'aggressive-short',
      'medium',
      `Reaction from ${fmt(shortEntry[0], 0)}-${fmt(shortEntry[1], 0)}`,
      'This is a resistance fade, not full bearish continuation confirmation. Better after wick rejection or weak close.',
      `Break above ${fmt(shortStop, 0)}`,
      'This setup is weaker if higher-timeframe trend remains strongly bullish.'
    );
  }

  if (trendState === 'range') {
    add(
      'Liquidity Sweep Watch',
      'neutral',
      'liquidity-sweep-watch',
      'medium',
      `Watch ${fmt(support1, 0)} below and ${fmt(resistance1, 0)} above`,
      'Range conditions often trap breakout traders. Sweeps above highs or below lows can offer the cleaner entry.',
      `Confirmed range break beyond ${fmt(resistance2, 0)} or ${fmt(support2, 0)}`,
      'Avoid forcing direction in mid-range.'
    );
  }

  if (nearResistance && !bearishStack) {
    add(
      'Breakout Watch',
      'neutral',
      'breakout-watch',
      'low',
      `Need clean acceptance above ${fmt(resistance1, 0)}`,
      'Price is close to breakout territory, but confirmation still matters more than anticipation.',
      `Failure back below ${fmt(ema21, 0)}`,
      'False breakouts are common when RSI is not expanding with price.'
    );
  }

  if (!signals.length) {
    add(
      'Wait / No Trade',
      'neutral',
      'wait',
      'low',
      'No clean edge at current location',
      'EMA alignment, RSI regime, and location do not provide enough edge right now.',
      'Wait for either support reaction, resistance rejection, or structure break',
      'No-trade is a valid position when edge is unclear.'
    );
  }

  return signals.slice(0, 4);
}

function getExecutionState(params: {
  price: number;
  bias: Bias;
  trendState: 'uptrend' | 'downtrend' | 'range';
  rsi: number;
  ema21: number;
  ema50: number;
  ema200: number;
  support1: number;
  resistance1: number;
  longEntry: [number, number];
  longStop: number;
  longTargets: number[];
  shortEntry: [number, number];
  shortStop: number;
  shortTargets: number[];
}): ExecutionState {
  const {
    price,
    bias,
    trendState,
    rsi,
    ema21,
    ema50,
    ema200,
    support1,
    resistance1,
    longEntry,
    longStop,
    longTargets,
    shortEntry,
    shortStop,
    shortTargets,
  } = params;

  const longRR =
    ((longTargets[1] ?? longTargets[0]) - longEntry[1]) / Math.max(longEntry[1] - longStop, 1);

  const shortRR =
    (shortEntry[0] - (shortTargets[1] ?? shortTargets[0])) / Math.max(shortStop - shortEntry[0], 1);

  let longLocation: ExecutionState['longLocation'] = 'early';
  if (price >= longEntry[0] && price <= longEntry[1]) longLocation = 'active';
  else if (price > longEntry[1] && price < (longTargets[0] ?? longEntry[1])) longLocation = 'late';
  else if (price < longStop) longLocation = 'invalid';

  let shortLocation: ExecutionState['shortLocation'] = 'early';
  if (price >= shortEntry[0] && price <= shortEntry[1]) shortLocation = 'active';
  else if (price < shortEntry[0] && price > (shortTargets[0] ?? shortEntry[0])) shortLocation = 'late';
  else if (price > shortStop) shortLocation = 'invalid';

  let longQuality = 50;
  if (trendState === 'uptrend') longQuality += 18;
  if (bias === 'bullish') longQuality += 12;
  if (ema21 > ema50 && ema50 > ema200) longQuality += 10;
  if (rsi >= 52 && rsi <= 68) longQuality += 8;
  if (price <= longEntry[1]) longQuality += 10;
  if (price > resistance1) longQuality -= 12;
  if (longRR < 2) longQuality -= 18;
  if (longLocation === 'late') longQuality -= 14;
  if (longLocation === 'invalid') longQuality = 5;

  let shortQuality = 50;
  if (trendState === 'downtrend') shortQuality += 18;
  if (bias === 'bearish') shortQuality += 12;
  if (ema21 < ema50 && ema50 < ema200) shortQuality += 10;
  if (rsi <= 48 && rsi >= 32) shortQuality += 8;
  if (price >= shortEntry[0]) shortQuality += 10;
  if (price < support1) shortQuality -= 12;
  if (shortRR < 2) shortQuality -= 18;
  if (shortLocation === 'late') shortQuality -= 14;
  if (shortLocation === 'invalid') shortQuality = 5;

  longQuality = clampScore(longQuality);
  shortQuality = clampScore(shortQuality);

  let longTone: ExecutionState['longTone'] = 'neutral';
  if (longQuality >= 75) longTone = 'good';
  else if (longQuality >= 55) longTone = 'neutral';
  else if (longQuality >= 30) longTone = 'warning';
  else longTone = 'danger';

  let shortTone: ExecutionState['shortTone'] = 'neutral';
  if (shortQuality >= 75) shortTone = 'good';
  else if (shortQuality >= 55) shortTone = 'neutral';
  else if (shortQuality >= 30) shortTone = 'warning';
  else shortTone = 'danger';

  const longRiskState =
    longLocation === 'invalid'
      ? 'Invalidated'
      : longLocation === 'late'
      ? 'Late / avoid chase'
      : longRR < 2
      ? 'Weak R:R'
      : trendState === 'downtrend'
      ? 'Counter-trend'
      : 'Acceptable';

  const shortRiskState =
    shortLocation === 'invalid'
      ? 'Invalidated'
      : shortLocation === 'late'
      ? 'Late / avoid pressing'
      : shortRR < 2
      ? 'Weak R:R'
      : trendState === 'uptrend'
      ? 'Counter-trend'
      : 'Acceptable';

  const longExecutionNote =
    longLocation === 'active'
      ? 'Price is inside the long entry area. Wait for hold or reaction confirmation.'
      : longLocation === 'early'
      ? 'Price has not reached long entry yet. Patience is better than forcing an early fill.'
      : longLocation === 'late'
      ? 'Price has already moved away from the long entry zone. Chasing weakens R:R.'
      : 'Long setup is invalid unless price rebuilds structure above the stop area.';

  const shortExecutionNote =
    shortLocation === 'active'
      ? 'Price is inside the short entry area. Prefer rejection or failed reclaim confirmation.'
      : shortLocation === 'early'
      ? 'Price has not reached short entry yet. Let price come into supply.'
      : shortLocation === 'late'
      ? 'Price has already moved away from the short entry zone. Pressing here reduces edge.'
      : 'Short setup is invalid unless price re-establishes acceptance below the stop area.';

  return {
    longLocation,
    shortLocation,
    longQuality,
    shortQuality,
    longRiskState,
    shortRiskState,
    longExecutionNote,
    shortExecutionNote,
    longTone,
    shortTone,
  };
}

export function buildStateFromCandles(
  candles: Candle[],
  sourceTime: string,
  context: any = {}
): DashboardState {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  const last = candles[candles.length - 1];
  const first24 = candles[Math.max(0, candles.length - 24)];

  const e21 = ema(closes, 21);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, Math.min(200, Math.max(2, closes.length - 1)));

  const ema21 = e21[e21.length - 1];
  const ema50 = e50[e50.length - 1];
  const ema200 = e200[e200.length - 1];
  const latestRsi = rsi(closes);

  const swingHigh = latestSwingHigh(candles, 20);
  const swingLow = latestSwingLow(candles, 20);

  let structure = 'Range';
  let trendState: 'uptrend' | 'downtrend' | 'range' = 'range';
  let bias: Bias = 'neutral';
  let confidence: 'low' | 'medium' | 'high' = 'low';

  if (last.close > ema21 && ema21 > ema50 && swingLow > Math.min(...lows.slice(-40, -20))) {
    structure = 'HH / HL';
    trendState = 'uptrend';
    bias = 'bullish';
    confidence = last.close > ema200 ? 'high' : 'medium';
  } else if (last.close < ema21 && ema21 < ema50 && swingHigh < Math.max(...highs.slice(-40, -20))) {
    structure = 'LH / LL';
    trendState = 'downtrend';
    bias = 'bearish';
    confidence = last.close < ema200 ? 'high' : 'medium';
  }

  const support1 = Math.min(...lows.slice(-12));
  const support2 = Math.min(...lows.slice(-30, -12));
  const resistance1 = Math.max(...highs.slice(-12));
  const resistance2 = Math.max(...highs.slice(-30, -12));

  const longEntry: [number, number] = [support1 * 1.002, support1 * 1.006];
  const longStop = support1 * 0.992;

  const shortEntry: [number, number] = [resistance1 * 0.994, resistance1 * 0.998];
  const shortStop = resistance1 * 1.009;

  const longTargets = uniqueSorted(
    [last.close * 1.01, resistance1 * 0.995, resistance2 * 0.995].filter((x) => x > longEntry[1]),
    'asc'
  );

  const shortTargets = uniqueSorted(
    [last.close * 0.99, support1 * 1.003, support2 * 1.004].filter((x) => x < shortEntry[0]),
    'desc'
  );

  const finalLongTargets = longTargets.length ? longTargets : [last.close * 1.01, last.close * 1.02];
  const finalShortTargets = shortTargets.length ? shortTargets : [last.close * 0.99, last.close * 0.98];

  const signals = buildSignals({
    price: last.close,
    bias,
    trendState,
    rsi: latestRsi,
    ema21,
    ema50,
    ema200,
    support1,
    support2,
    resistance1,
    resistance2,
    longEntry,
    longStop,
    longTargets: finalLongTargets,
    shortEntry,
    shortStop,
    shortTargets: finalShortTargets,
  });

  const execution = getExecutionState({
    price: last.close,
    bias,
    trendState,
    rsi: latestRsi,
    ema21,
    ema50,
    ema200,
    support1,
    resistance1,
    longEntry,
    longStop,
    longTargets: finalLongTargets,
    shortEntry,
    shortStop,
    shortTargets: finalShortTargets,
  });

  return {
    price: last.close,
    change24h: ((last.close - first24.close) / first24.close) * 100,
    high24h: Math.max(...highs.slice(-24)),
    low24h: Math.min(...lows.slice(-24)),
    volume24h: volumes.slice(-24).reduce((a, b) => a + b, 0),
    updatedAt: sourceTime,

    bias,
    confidence,
    structure,
    trendState,
    swingHigh,
    swingLow,
    biasFlipLevel: bias === 'bullish' ? ema50 : bias === 'bearish' ? ema50 : last.close,

    rsi: latestRsi,
    ema21,
    ema50,
    ema200,
    macdState:
      ema21 > ema50
        ? 'Bullish momentum bias'
        : ema21 < ema50
        ? 'Bearish momentum bias'
        : 'Neutral momentum state',

    supports: uniqueSorted([support1, support2], 'asc'),
    resistances: uniqueSorted([resistance1, resistance2], 'desc'),

    longEntry,
    longStop,
    longTargets: finalLongTargets,

    shortEntry,
    shortStop,
    shortTargets: finalShortTargets,
   
        execution,
context: context ?? {},

dxy: context?.dxy ?? 'Unavailable',
spy: context?.spy ?? 'Unavailable',
ethbtc: context?.ethbtc ?? 'Unavailable',

    candles,
    signals,
  }
};