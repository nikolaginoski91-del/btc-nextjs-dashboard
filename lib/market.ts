import {
  Candle,
  DashboardState,
  Bias,
  SignalCard,
  SignalStrength,
  Timeframe,
  ExecutionState,
} from './types';
import { buildMultiTimeframeAlignment } from './mtf-alignment';

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
  const unique = Array.from(
    new Set(values.filter((x) => Number.isFinite(x)).map((x) => Number(x.toFixed(2))))
  );
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
    ((longTargets[1] ?? longTargets[0]) - longEntry[1]) /
    Math.max(longEntry[1] - longStop, 1);

  const shortRR =
    (shortEntry[0] - (shortTargets[1] ?? shortTargets[0])) /
    Math.max(shortStop - shortEntry[0], 1);

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
    ((longTargets[1] ?? longTargets[0]) - longEntry[1]) /
    Math.max(longEntry[1] - longStop, 1);

  const shortRR =
    (shortEntry[0] - (shortTargets[1] ?? shortTargets[0])) /
    Math.max(shortStop - shortEntry[0], 1);

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

function applyMtfAdjustment(baseExecution: ExecutionState, mtf: any): ExecutionState {
  let longQuality = baseExecution.longQuality;
  let shortQuality = baseExecution.shortQuality;

  switch (mtf?.alignment) {
    case 'strong_bullish':
      longQuality += 12;
      shortQuality -= 18;
      break;
    case 'bullish':
      longQuality += 8;
      shortQuality -= 12;
      break;
    case 'strong_bearish':
      longQuality -= 18;
      shortQuality += 12;
      break;
    case 'bearish':
      longQuality -= 12;
      shortQuality += 8;
      break;
    default:
      longQuality -= 6;
      shortQuality -= 6;
      break;
  }

  if (mtf?.longAllowed === false) longQuality -= 8;
  if (mtf?.shortAllowed === false) shortQuality -= 8;

  longQuality = clampScore(longQuality);
  shortQuality = clampScore(shortQuality);

  const longTone: ExecutionState['longTone'] =
    longQuality >= 75 ? 'good' : longQuality >= 55 ? 'neutral' : longQuality >= 30 ? 'warning' : 'danger';

  const shortTone: ExecutionState['shortTone'] =
    shortQuality >= 75 ? 'good' : shortQuality >= 55 ? 'neutral' : shortQuality >= 30 ? 'warning' : 'danger';

  return {
    ...baseExecution,
    longQuality,
    shortQuality,
    longTone,
    shortTone,
  };
}

function buildExecutionComment(params: {
  bias: Bias;
  trendState: 'uptrend' | 'downtrend' | 'range';
  execution: ExecutionState;
  mtf: any;
  price: number;
  longEntry: [number, number];
  shortEntry: [number, number];
}) {
  const { bias, trendState, execution, mtf, price, longEntry, shortEntry } = params;

  const insideLong = price >= longEntry[0] && price <= longEntry[1];
  const insideShort = price >= shortEntry[0] && price <= shortEntry[1];

  if (mtf?.alignment === 'strong_bullish') {
    return insideLong
      ? 'Higher timeframe alignment is strongly bullish and price is already in the long zone. Focus on reaction quality, not speed.'
      : 'Higher timeframe alignment is strongly bullish. Longs are the primary side, but entries should still come from pullback or reclaim, not chase.';
  }

  if (mtf?.alignment === 'bullish') {
    return insideLong
      ? 'Higher timeframe bias supports longs and price is in the long area. Best execution is reactive: hold, reclaim, then go.'
      : 'Higher timeframe bias supports longs, but the execution layer still needs cleaner local confirmation before pressing.';
  }

  if (mtf?.alignment === 'strong_bearish') {
    return insideShort
      ? 'Higher timeframe alignment is strongly bearish and price is already in the short zone. Prefer rejection and failure, not anticipation.'
      : 'Higher timeframe alignment is strongly bearish. Shorts are the primary side, but entries should still come from rejection, not forced selling.';
  }

  if (mtf?.alignment === 'bearish') {
    return insideShort
      ? 'Higher timeframe bias supports shorts and price is in the short area. Best execution is rejection first, then weakness.'
      : 'Higher timeframe bias supports shorts, but the execution layer still needs cleaner local confirmation before pressing.';
  }

  if (trendState === 'range') {
    return 'Timeframes are mixed and the market is rotating. Best edge is reactive, not predictive. Wait for a cleaner trigger.';
  }

  if (execution.longQuality > execution.shortQuality) {
    return 'The higher timeframe picture is mixed, but local execution still leans slightly long. That is not the same as a clean trend trade, so stay selective.';
  }

  if (execution.shortQuality > execution.longQuality) {
    return 'The higher timeframe picture is mixed, but local execution still leans slightly short. That is not the same as a clean trend trade, so stay selective.';
  }

  return `BTC is currently showing a ${bias} local read, but timeframe alignment is mixed. Confirmation matters more than opinion here.`;
}

function buildOperatorLists(params: {
  bias: Bias;
  trendState: 'uptrend' | 'downtrend' | 'range';
  execution: ExecutionState;
  mtf: any;
  longEntry: [number, number];
  longStop: number;
  longTargets: number[];
  shortEntry: [number, number];
  shortStop: number;
  shortTargets: number[];
  ema21: number;
  rsi: number;
  preferredSide: 'LONG' | 'SHORT' | 'NEUTRAL';
}) {
  const {
    bias,
    trendState,
    execution,
    mtf,
    longEntry,
    longStop,
    longTargets,
    shortEntry,
    shortStop,
    shortTargets,
    ema21,
    rsi,
    preferredSide,
  } = params;

  const longWhy = [
    `Long zone sits around ${fmt(longEntry[0], 0)} - ${fmt(longEntry[1], 0)}.`,
    `This setup is ${
      execution.longQuality >= 70
        ? 'high quality'
        : execution.longQuality >= 50
        ? 'tradable but not clean'
        : 'weak and conditional'
    }.`,
    `RSI is ${fmt(rsi, 1)} and local trend state is ${trendState}.`,
  ];

  const shortWhy = [
    `Short zone sits around ${fmt(shortEntry[0], 0)} - ${fmt(shortEntry[1], 0)}.`,
    `This setup is ${
      execution.shortQuality >= 70
        ? 'high quality'
        : execution.shortQuality >= 50
        ? 'tradable but not clean'
        : 'weak and conditional'
    }.`,
    `RSI is ${fmt(rsi, 1)} and local trend state is ${trendState}.`,
  ];

  const longConfirmations = [
    `Price should hold or reclaim above ${fmt(longEntry[1], 0)} after testing demand.`,
    `A clean response back above EMA21 near ${fmt(ema21, 0)} improves long quality.`,
    `There should still be room toward ${fmt(longTargets[0], 0)} without immediate resistance pressure.`,
  ];

  const shortConfirmations = [
    `Price should reject inside ${fmt(shortEntry[0], 0)} - ${fmt(shortEntry[1], 0)} instead of accepting above it.`,
    `A failed reclaim or weakness back below EMA21 near ${fmt(ema21, 0)} improves short quality.`,
    `There should still be room toward ${fmt(shortTargets[0], 0)} without immediate support absorbing the move.`,
  ];

  const longInvalidations = [
    `The long idea weakens below ${fmt(longStop, 0)}.`,
    mtf?.longAllowed
      ? 'Even if the long remains valid, chasing after expansion damages the trade.'
      : 'Higher timeframe alignment is already against the long side, so this setup needs more proof than usual.',
  ];

  const shortInvalidations = [
    `The short idea weakens above ${fmt(shortStop, 0)}.`,
    mtf?.shortAllowed
      ? 'Even if the short remains valid, pressing into support damages the trade.'
      : 'Higher timeframe alignment is already against the short side, so this setup needs more proof than usual.',
  ];

  const avoidTradeReason =
    mtf?.alignment === 'mixed'
      ? 'Avoid trading in the middle of the range. No side has control.'
      : preferredSide === 'LONG'
      ? 'Avoid the trade if price reaches the long zone but fails to hold or reclaim.'
      : preferredSide === 'SHORT'
      ? 'Avoid the trade if price reaches the short zone but does not reject cleanly.'
      : 'Avoid trading without a clear trigger. No edge = no trade.';

  return {
    longWhy,
    shortWhy,
    longConfirmations,
    shortConfirmations,
    longInvalidations,
    shortInvalidations,
    avoidTradeReason,
  };
}


function buildReadinessState(params: {
  price: number;
  longEntry: [number, number];
  shortEntry: [number, number];
  execution: ExecutionState;
  mtf: any;
  trendState: 'uptrend' | 'downtrend' | 'range';
  support1: number;
  resistance1: number;
}) {
  const { price, longEntry, shortEntry, execution, mtf, trendState, support1, resistance1 } = params;

  const insideLong = price >= longEntry[0] && price <= longEntry[1];
  const insideShort = price >= shortEntry[0] && price <= shortEntry[1];

  const bestScore = Math.max(execution.longQuality, execution.shortQuality);
  const preferredSide =
    execution.longQuality >= execution.shortQuality + 8
      ? 'LONG'
      : execution.shortQuality >= execution.longQuality + 8
      ? 'SHORT'
      : 'NEUTRAL';

  let status = 'SETUP FORMING';
  if (bestScore < 40) status = 'AVOID';
  else if (insideLong || insideShort) status = 'ACTIVE ZONE';
  else if (bestScore >= 70) status = 'TRIGGER READY';
  else if (bestScore >= 50) status = 'SETUP FORMING';
  else status = 'WATCHLIST';

  let nextTrigger = 'Wait for cleaner confirmation.';
  if (preferredSide === 'LONG') {
    nextTrigger = `Watch for sweep/hold near ${fmt(longEntry[1], 0)} or reclaim strength above ${fmt(resistance1, 0)}.`;
  } else if (preferredSide === 'SHORT') {
    nextTrigger = `Watch for rejection inside ${fmt(shortEntry[0], 0)} - ${fmt(shortEntry[1], 0)} or weakness back below ${fmt(support1, 0)}.`;
  } else if (trendState === 'range') {
    nextTrigger = `Wait for one of two things: sweep below ${fmt(longEntry[1], 0)} and reclaim, or breakout close above ${fmt(shortEntry[0], 0)}.`;
  }

  let doNotTradeIf = 'No edge = no trade.';
  if (mtf?.alignment === 'mixed') {
    doNotTradeIf = `BTC keeps chopping between ${fmt(longEntry[1], 0)} and ${fmt(shortEntry[0], 0)} without confirmation.`;
  } else if (preferredSide === 'LONG') {
    doNotTradeIf = `Price reaches the long zone but cannot hold above ${fmt(longEntry[0], 0)}.`;
  } else if (preferredSide === 'SHORT') {
    doNotTradeIf = `Price reaches the short zone but does not reject or reclaim weakness.`;
  }

  return { status, nextTrigger, doNotTradeIf };
}


function buildSmartAlert(params: {
  price: number;
  longEntry: [number, number];
  shortEntry: [number, number];
  longStop: number;
  shortStop: number;
  resistance1: number;
  support1: number;
  execution: ExecutionState;
  mtf: any;
  trendState: 'uptrend' | 'downtrend' | 'range';
}) {
  const {
    price,
    longEntry,
    shortEntry,
    longStop,
    shortStop,
    resistance1,
    support1,
    execution,
    mtf,
    trendState,
  } = params;

  const longZoneMid = (longEntry[0] + longEntry[1]) / 2;
  const shortZoneMid = (shortEntry[0] + shortEntry[1]) / 2;

  const distToLong = Math.abs(price - longZoneMid) / price;
  const distToShort = Math.abs(price - shortZoneMid) / price;

  const insideLong = price >= longEntry[0] && price <= longEntry[1];
  const insideShort = price >= shortEntry[0] && price <= shortEntry[1];

  const nearLong = distToLong <= 0.0045;
  const nearShort = distToShort <= 0.0045;

  let title = 'NO CLEAN ALERT';
  let tone: 'good' | 'neutral' | 'warning' | 'danger' = 'neutral';
  let priority = 10;
  let note = 'No side is close enough or clean enough to justify alert mode.';
  let trigger = 'Wait for price to approach a real execution zone.';
  let side: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (insideLong && execution.longQuality >= 55) {
    title = 'LONG ACTIVE ZONE';
    tone = execution.longQuality >= 70 ? 'good' : 'warning';
    priority = 95;
    note = 'Price is inside the long entry zone. Wait for hold / reclaim confirmation.';
    trigger = `Long zone active between ${fmt(longEntry[0], 0)} and ${fmt(longEntry[1], 0)}.`;
    side = 'LONG';
  } else if (insideShort && execution.shortQuality >= 55) {
    title = 'SHORT ACTIVE ZONE';
    tone = execution.shortQuality >= 70 ? 'danger' : 'warning';
    priority = 95;
    note = 'Price is inside the short entry zone. Prefer rejection / failed reclaim.';
    trigger = `Short zone active between ${fmt(shortEntry[0], 0)} and ${fmt(shortEntry[1], 0)}.`;
    side = 'SHORT';
  } else if (nearLong && execution.longQuality >= 50 && mtf?.longAllowed !== false) {
    title = 'WATCH LONG REACTION';
    tone = 'warning';
    priority = 78;
    note = 'Price is approaching long demand. Watch for sweep, hold, or reclaim.';
    trigger = `Watch reaction near ${fmt(longEntry[1], 0)} and strength back above ${fmt(resistance1, 0)}.`;
    side = 'LONG';
  } else if (nearShort && execution.shortQuality >= 50 && mtf?.shortAllowed !== false) {
    title = 'WATCH SHORT REJECTION';
    tone = 'warning';
    priority = 78;
    note = 'Price is approaching short supply. Watch for rejection or failed reclaim.';
    trigger = `Watch rejection near ${fmt(shortEntry[0], 0)} and weakness back below ${fmt(support1, 0)}.`;
    side = 'SHORT';
  } else if (trendState === 'range') {
    title = 'RANGE ROTATION';
    tone = 'neutral';
    priority = 40;
    note = 'Market is rotating inside a range. Best entries usually come after sweeps, not in the middle.';
    trigger = `Watch below ${fmt(longEntry[1], 0)} or above ${fmt(shortEntry[0], 0)} for cleaner reaction.`;
    side = 'NEUTRAL';
  }

  if (price < longStop || price > shortStop) {
    priority = Math.max(5, priority - 15);
  }

  return {
    title,
    tone,
    priority,
    note,
    trigger,
    side,
  };
}


function buildMacroOverlay(params: {
  bias: Bias;
  trendState: 'uptrend' | 'downtrend' | 'range';
  preferredSide: 'LONG' | 'SHORT' | 'NEUTRAL';
  tradeReadiness: number;
  dxy?: string | number;
  spy?: string | number;
  ethbtc?: string | number;
}) {
  const { bias, trendState, preferredSide, tradeReadiness, dxy, spy, ethbtc } = params;

  const regime =
    bias === 'bullish' && tradeReadiness >= 70
      ? 'RISK-ON'
      : bias === 'bearish' && tradeReadiness >= 70
      ? 'RISK-OFF'
      : trendState === 'range'
      ? 'MIXED / ROTATIONAL'
      : 'TRANSITION';

  const stance =
    preferredSide === 'LONG'
      ? 'FAVOR LONGS'
      : preferredSide === 'SHORT'
      ? 'FAVOR SHORTS'
      : 'STAY SELECTIVE';

  const liquidityState =
    tradeReadiness >= 75
      ? 'Clean enough for execution if trigger appears.'
      : tradeReadiness >= 55
      ? 'Tradable only with confirmation.'
      : 'No real liquidity edge yet.';

  return {
    regime,
    stance,
    dxySignal: dxy ?? 'Unavailable',
    spySignal: spy ?? 'Unavailable',
    ethBtcSignal: ethbtc ?? 'Unavailable',
    liquidityState,
    action:
      preferredSide === 'LONG'
        ? 'Look for pullback hold or reclaim before long.'
        : preferredSide === 'SHORT'
        ? 'Look for rejection or failed reclaim before short.'
        : 'Wait for either sweep + reclaim or clean breakout acceptance.',
    summary:
      regime === 'RISK-ON'
        ? 'Macro overlay is supportive enough for BTC continuation, but execution still matters more than opinion.'
        : regime === 'RISK-OFF'
        ? 'Macro overlay is defensive. Force less, size smaller, and prefer weakness over prediction.'
        : 'Macro overlay is mixed. Treat this as a reaction market, not a conviction market.',
    riskNote:
      preferredSide === 'LONG'
        ? 'If BTC cannot hold demand, bullish macro narrative is not enough.'
        : preferredSide === 'SHORT'
        ? 'If BTC cannot reject supply, bearish macro narrative is not enough.'
        : 'Mixed macro + mixed structure usually means chop risk stays elevated.',
  };
}

function buildAiResearchMode(params: {
  bias: Bias;
  trendState: 'uptrend' | 'downtrend' | 'range';
  preferredSide: 'LONG' | 'SHORT' | 'NEUTRAL';
  tradeReadiness: number;
  longEntry: [number, number];
  shortEntry: [number, number];
  longStop: number;
  shortStop: number;
  smartAlert: {
    title: string;
    trigger: string;
  };
}) {
  const {
    bias,
    trendState,
    preferredSide,
    tradeReadiness,
    longEntry,
    shortEntry,
    longStop,
    shortStop,
    smartAlert,
  } = params;

  const marketRegime =
    trendState === 'uptrend'
      ? 'Trend continuation'
      : trendState === 'downtrend'
      ? 'Trend pressure'
      : 'Range / rotation';

  const executionFocus =
    preferredSide === 'LONG'
      ? `Focus on long reactions around ${fmt(longEntry[0], 0)} - ${fmt(longEntry[1], 0)}.`
      : preferredSide === 'SHORT'
      ? `Focus on short reactions around ${fmt(shortEntry[0], 0)} - ${fmt(shortEntry[1], 0)}.`
      : 'Focus on patience until one side proves control.';

  const invalidation =
    preferredSide === 'LONG'
      ? `Lose ${fmt(longStop, 0)} and the long idea weakens materially.`
      : preferredSide === 'SHORT'
      ? `Reclaim above ${fmt(shortStop, 0)} and the short idea weakens materially.`
      : 'A clean acceptance outside the current rotation invalidates the neutral stance.';

  return {
    title: 'AI Research Mode',
    marketRegime,
    executionFocus,
    summary:
      preferredSide === 'LONG'
        ? 'Base case favors selective longs, but only after reaction quality confirms.'
        : preferredSide === 'SHORT'
        ? 'Base case favors selective shorts, but only after rejection quality confirms.'
        : 'Base case is mixed. Capital preservation is part of the strategy here.',
    opportunity:
      preferredSide === 'LONG'
        ? 'Best opportunity comes from demand holding and momentum re-expanding.'
        : preferredSide === 'SHORT'
        ? 'Best opportunity comes from supply holding and momentum failing.'
        : 'Best opportunity comes after a sweep or a confirmed break from the range.',
    risk:
      tradeReadiness >= 70
        ? 'Main risk is chasing after the move already started.'
        : 'Main risk is trading opinion before trigger confirmation.',
    invalidation,
    nextCatalyst: smartAlert.trigger,
    checklist: [
      `Current research bias: ${bias.toUpperCase()}.`,
      `Current structure: ${marketRegime}.`,
      `Trade readiness score: ${tradeReadiness}/100.`,
      `Live smart alert: ${smartAlert.title}.`,
    ],
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
  } else if (
    last.close < ema21 &&
    ema21 < ema50 &&
    swingHigh < Math.max(...highs.slice(-40, -20))
  ) {
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

  const finalLongTargets = longTargets.length
    ? longTargets
    : [last.close * 1.01, last.close * 1.02];

  const finalShortTargets = shortTargets.length
    ? shortTargets
    : [last.close * 0.99, last.close * 0.98];

  const mtf = buildMultiTimeframeAlignment({
    weekly: {
      emaFast: ema200,
      emaSlow: ema50,
      price: last.close,
      rsi: Math.max(
        40,
        Math.min(65, latestRsi + (bias === 'bullish' ? 4 : bias === 'bearish' ? -4 : 0))
      ),
    },
    daily: {
      emaFast: ema50,
      emaSlow: ema200,
      price: last.close,
      rsi: latestRsi,
    },
    fourHour: {
      emaFast: ema21,
      emaSlow: ema50,
      price: last.close,
      rsi: latestRsi,
    },
  });

  const baseExecution = getExecutionState({
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

  const execution = applyMtfAdjustment(baseExecution, mtf);

  const preferredSide =
    execution.longQuality >= execution.shortQuality + 8
      ? 'LONG'
      : execution.shortQuality >= execution.longQuality + 8
      ? 'SHORT'
      : 'NEUTRAL';

  const readiness = buildReadinessState({
    price: last.close,
    longEntry,
    shortEntry,
    execution,
    mtf,
    trendState,
    support1,
    resistance1,
  });

  const smartAlert = buildSmartAlert({
    price: last.close,
    longEntry,
    shortEntry,
    longStop,
    shortStop,
    resistance1,
    support1,
    execution,
    mtf,
    trendState,
  });

  const tradeReadiness = clampScore(
    mtf?.alignment === 'mixed'
      ? Math.max(execution.longQuality, execution.shortQuality) - 4
      : Math.max(execution.longQuality, execution.shortQuality)
  );

  const smartEdge = clampScore(Math.max(execution.longQuality, execution.shortQuality));

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

  const executionComment =
    context?.executionComment ??
    buildExecutionComment({
      bias,
      trendState,
      execution,
      mtf,
      price: last.close,
      longEntry,
      shortEntry,
    });

  const operatorLists = buildOperatorLists({
    bias,
    trendState,
    execution,
    mtf,
    longEntry,
    longStop,
    longTargets: finalLongTargets,
    shortEntry,
    shortStop,
    shortTargets: finalShortTargets,
    ema21,
    rsi: latestRsi,
    preferredSide,
  });

  const safeContext = {
    dxy: context?.dxy ?? 'Unavailable',
    spy: context?.spy ?? 'Unavailable',
    ethbtc: context?.ethbtc ?? 'Unavailable',

    executionComment,

    longReasons:
      context?.longReasons ??
      [
        mtf?.longAllowed
          ? 'Higher timeframe filter is not blocking longs.'
          : 'Higher timeframe filter is not favoring longs right now.',
        execution.longLocation === 'active'
          ? 'Price is already inside the long zone.'
          : execution.longLocation === 'early'
          ? 'Price has not fully reached the long zone yet.'
          : execution.longLocation === 'late'
          ? 'The long location is already getting late.'
          : 'The long structure is currently weak.',
      ],

    shortReasons:
      context?.shortReasons ??
      [
        mtf?.shortAllowed
          ? 'Higher timeframe filter is not blocking shorts.'
          : 'Higher timeframe filter is not favoring shorts right now.',
        execution.shortLocation === 'active'
          ? 'Price is already inside the short zone.'
          : execution.shortLocation === 'early'
          ? 'Price has not fully reached the short zone yet.'
          : execution.shortLocation === 'late'
          ? 'The short location is already getting late.'
          : 'The short structure is currently weak.',
      ],

    whyLong: context?.whyLong ?? operatorLists.longWhy,
    whyShort: context?.whyShort ?? operatorLists.shortWhy,
    longConfirmations: context?.longConfirmations ?? operatorLists.longConfirmations,
    shortConfirmations: context?.shortConfirmations ?? operatorLists.shortConfirmations,
    longInvalidations: context?.longInvalidations ?? operatorLists.longInvalidations,
    shortInvalidations: context?.shortInvalidations ?? operatorLists.shortInvalidations,
    avoidTradeReason: context?.avoidTradeReason ?? operatorLists.avoidTradeReason,

    tradeReadiness: context?.tradeReadiness ?? tradeReadiness,
    smartEdge: context?.smartEdge ?? smartEdge,
    canTradeNow:
      context?.canTradeNow ??
      (readiness.status === 'ACTIVE ZONE' || readiness.status === 'TRIGGER READY'),
    readinessStatus: context?.readinessStatus ?? readiness.status,
    nextTrigger: context?.nextTrigger ?? readiness.nextTrigger,
    doNotTradeIf: context?.doNotTradeIf ?? readiness.doNotTradeIf,
    longExecution: context?.longExecution ?? execution.longQuality,
    shortExecution: context?.shortExecution ?? execution.shortQuality,
    preferredSide: context?.preferredSide ?? preferredSide,

    longEntryQuality: context?.longEntryQuality,
    shortEntryQuality: context?.shortEntryQuality,
    longChaseWarning: context?.longChaseWarning,
    shortChaseWarning: context?.shortChaseWarning,
    bestEntrySide: context?.bestEntrySide,
    entryComment: context?.entryComment,

    longTriggerState: context?.longTriggerState,
    shortTriggerState: context?.shortTriggerState,
    longConfirmationScore: context?.longConfirmationScore,
    shortConfirmationScore: context?.shortConfirmationScore,
    bestActiveTrigger: context?.bestActiveTrigger,
    triggerComment: context?.triggerComment,
    triggerFailureWarning: context?.triggerFailureWarning,

    smartAlert,
    macroOverlay:
      context?.macroOverlay ??
      buildMacroOverlay({
        bias,
        trendState,
        preferredSide,
        tradeReadiness,
        dxy: context?.dxy,
        spy: context?.spy,
        ethbtc: context?.ethbtc,
      }),
    aiResearch:
      context?.aiResearch ??
      buildAiResearchMode({
        bias,
        trendState,
        preferredSide,
        tradeReadiness,
        longEntry,
        shortEntry,
        longStop,
        shortStop,
        smartAlert,
      }),
    mtfAlignment: mtf,
  };

  return {
    price: last.close,
    change24h: ((last.close - first24.close) / first24.close) * 100,
    high24h: Math.max(...highs.slice(-24)),
    low24h: Math.min(...lows.slice(-24)),
    volume24h: volumes.slice(-24).reduce((sum, v) => sum + v, 0),
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

    supports: uniqueSorted([support1, support2], 'desc'),
    resistances: uniqueSorted([resistance1, resistance2], 'asc'),

    longEntry,
    longStop,
    longTargets: finalLongTargets,

    shortEntry,
    shortStop,
    shortTargets: finalShortTargets,

    execution,
    context: safeContext,

    dxy: safeContext.dxy,
    spy: safeContext.spy,
    ethbtc: safeContext.ethbtc,

    candles,
    signals,
  };
}

/* ------------------------------------------------------------------ */
/* Phase 6.7 — Trade Journal + Outcome Tracker                         */
/* Additive. Pure helpers + types. No effect on Phase 6.6 logic.       */
/* ------------------------------------------------------------------ */

export type JournalResult = 'win' | 'loss' | 'break-even' | 'skipped';

export type JournalSide = 'long' | 'short';

export type JournalSetupType =
  | 'trend-continuation'
  | 'breakout'
  | 'pullback'
  | 'reversal'
  | 'range'
  | 'liquidity-sweep';

export type JournalMistakeTag =
  | 'none'
  | 'late-entry'
  | 'early-entry'
  | 'moved-stop'
  | 'ignored-gate'
  | 'oversized'
  | 'revenge-trade'
  | 'no-confirmation'
  | 'poor-tp';

export type TradeJournalEntry = {
  id: string;
  createdAt: string; // ISO UTC string
  side: JournalSide;
  entry: number | null;
  stop: number | null;
  tp: number | null;
  result: JournalResult;
  setupType: JournalSetupType;
  regimeAtEntry: string;
  tradeGateAtEntry: string;
  riskPresetUsed: string;
  notes: string;
  mistakeTag: JournalMistakeTag;
};

export const JOURNAL_STORAGE_KEY = 'btc_dashboard_trade_journal_v1';

// Deterministic UTC formatter — safe for SSR/hydration.
export function formatJournalDateUTC(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm} UTC`;
  } catch {
    return '—';
  }
}

export type JournalStats = {
  total: number;
  wins: number;
  losses: number;
  breakEvens: number;
  skipped: number;
  winRate: number; // 0-100, computed from wins / (wins+losses)
  mistakeCounts: Record<JournalMistakeTag, number>;
  setupCounts: Record<JournalSetupType, number>;
  topMistake: JournalMistakeTag | null;
  topSetup: JournalSetupType | null;
};

export function computeJournalStats(entries: TradeJournalEntry[]): JournalStats {
  const mistakeCounts: Record<JournalMistakeTag, number> = {
    'none': 0,
    'late-entry': 0,
    'early-entry': 0,
    'moved-stop': 0,
    'ignored-gate': 0,
    'oversized': 0,
    'revenge-trade': 0,
    'no-confirmation': 0,
    'poor-tp': 0,
  };

  const setupCounts: Record<JournalSetupType, number> = {
    'trend-continuation': 0,
    'breakout': 0,
    'pullback': 0,
    'reversal': 0,
    'range': 0,
    'liquidity-sweep': 0,
  };

  let wins = 0;
  let losses = 0;
  let breakEvens = 0;
  let skipped = 0;

  for (const e of entries) {
    if (e.result === 'win') wins += 1;
    else if (e.result === 'loss') losses += 1;
    else if (e.result === 'break-even') breakEvens += 1;
    else if (e.result === 'skipped') skipped += 1;

    if (e.mistakeTag in mistakeCounts) mistakeCounts[e.mistakeTag] += 1;
    if (e.setupType in setupCounts) setupCounts[e.setupType] += 1;
  }

  const decisive = wins + losses;
  const winRate = decisive > 0 ? Math.round((wins / decisive) * 100) : 0;

  let topMistake: JournalMistakeTag | null = null;
  let topMistakeCount = 0;
  (Object.keys(mistakeCounts) as JournalMistakeTag[]).forEach((k) => {
    if (k === 'none') return;
    if (mistakeCounts[k] > topMistakeCount) {
      topMistakeCount = mistakeCounts[k];
      topMistake = k;
    }
  });

  let topSetup: JournalSetupType | null = null;
  let topSetupCount = 0;
  (Object.keys(setupCounts) as JournalSetupType[]).forEach((k) => {
    if (setupCounts[k] > topSetupCount) {
      topSetupCount = setupCounts[k];
      topSetup = k;
    }
  });

  return {
    total: entries.length,
    wins,
    losses,
    breakEvens,
    skipped,
    winRate,
    mistakeCounts,
    setupCounts,
    topMistake,
    topSetup,
  };
}

export function makeJournalId(): string {
  // Simple, non-cryptographic id — safe across browsers.
  return `tj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}