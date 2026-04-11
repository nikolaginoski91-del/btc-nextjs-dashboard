// lib/regime-engine.ts

export type MarketRegime =
  | "TRENDING_BULL"
  | "TRENDING_BEAR"
  | "RANGE"
  | "TRANSITION"
  | "BREAKOUT_WATCH";

export interface RegimeInput {
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  atrPercent: number;
  volumeRatio: number;
  trendStrength: number; // 0 - 100
}

export interface RegimeResult {
  regime: MarketRegime;
  confidence: number;

  directionBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  tradeCondition: "FAVORABLE" | "CAUTION" | "DEFENSIVE";

  bullScore: number;
  bearScore: number;
  rangeScore: number;
  breakoutScore: number;

  summary: string;
  operatorNote: string;

  confirms: string[];
  invalidates: string[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(n: number) {
  return Math.round(n);
}

export function classifyRegime(input: RegimeInput): RegimeResult {
  const {
    price,
    ema20,
    ema50,
    ema200,
    rsi,
    atrPercent,
    volumeRatio,
    trendStrength,
  } = input;

  let bullScore = 0;
  let bearScore = 0;
  let rangeScore = 0;
  let breakoutScore = 0;

  if (price > ema20) bullScore += 12;
  else bearScore += 12;

  if (price > ema50) bullScore += 16;
  else bearScore += 16;

  if (price > ema200) bullScore += 20;
  else bearScore += 20;

  if (ema20 > ema50) bullScore += 14;
  else bearScore += 14;

  if (ema50 > ema200) bullScore += 18;
  else bearScore += 18;

  if (rsi >= 55 && rsi <= 72) bullScore += 10;
  if (rsi <= 45 && rsi >= 28) bearScore += 10;
  if (rsi >= 47 && rsi <= 53) rangeScore += 14;

  if (atrPercent < 1.6) rangeScore += 18;
  if (atrPercent > 2.8) breakoutScore += 14;

  if (volumeRatio > 1.15) breakoutScore += 16;
  if (volumeRatio < 0.95) rangeScore += 10;

  if (trendStrength >= 70) {
    if (bullScore > bearScore) bullScore += 14;
    if (bearScore > bullScore) bearScore += 14;
  }

  if (trendStrength < 45) {
    rangeScore += 18;
  }

  const emaCompression =
    Math.abs(ema20 - ema50) / Math.max(price, 1) < 0.006 &&
    Math.abs(ema50 - ema200) / Math.max(price, 1) < 0.015;

  if (emaCompression && atrPercent < 2.0) {
    breakoutScore += 22;
    rangeScore += 8;
  }

  bullScore = clamp(round(bullScore), 0, 100);
  bearScore = clamp(round(bearScore), 0, 100);
  rangeScore = clamp(round(rangeScore), 0, 100);
  breakoutScore = clamp(round(breakoutScore), 0, 100);

  let regime: MarketRegime = "TRANSITION";
  let confidence = 50;
  let directionBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let tradeCondition: "FAVORABLE" | "CAUTION" | "DEFENSIVE" = "CAUTION";
  let summary = "Mixed market environment.";
  let operatorNote = "Stay selective. Conditions are not fully aligned.";

  const topTrendScore = Math.max(bullScore, bearScore);

  if (breakoutScore >= 32 && rangeScore >= 18 && topTrendScore < 75) {
    regime = "BREAKOUT_WATCH";
    confidence = clamp(round((breakoutScore + rangeScore) / 2), 55, 85);
    directionBias =
      bullScore > bearScore ? "BULLISH" : bearScore > bullScore ? "BEARISH" : "NEUTRAL";
    tradeCondition = "CAUTION";
    summary = "Market is compressed and may expand soon.";
    operatorNote = "Wait for confirmation candle before forcing a trade.";
  } else if (bullScore >= 72 && bullScore > bearScore + 10) {
    regime = "TRENDING_BULL";
    confidence = clamp(round((bullScore + trendStrength) / 2), 60, 95);
    directionBias = "BULLISH";
    tradeCondition = "FAVORABLE";
    summary = "Bullish trend environment is active.";
    operatorNote = "Favor longs on confirmation. Avoid emotional shorts.";
  } else if (bearScore >= 72 && bearScore > bullScore + 10) {
    regime = "TRENDING_BEAR";
    confidence = clamp(round((bearScore + trendStrength) / 2), 60, 95);
    directionBias = "BEARISH";
    tradeCondition = "FAVORABLE";
    summary = "Bearish trend environment is active.";
    operatorNote = "Favor shorts on confirmation. Avoid bottom catching.";
  } else if (rangeScore >= 32 && topTrendScore < 72) {
    regime = "RANGE";
    confidence = clamp(round((rangeScore + (100 - trendStrength)) / 2), 55, 88);
    directionBias = "NEUTRAL";
    tradeCondition = "DEFENSIVE";
    summary = "Market is rotational / range-bound.";
    operatorNote = "Avoid chasing breakouts unless structure clearly shifts.";
  } else {
    regime = "TRANSITION";
    confidence = clamp(round((topTrendScore + breakoutScore) / 2), 50, 80);
    directionBias =
      bullScore > bearScore ? "BULLISH" : bearScore > bullScore ? "BEARISH" : "NEUTRAL";
    tradeCondition = "CAUTION";
    summary = "Market is shifting between conditions.";
    operatorNote = "Reduce size and wait for cleaner alignment.";
  }

  const confirms: string[] = [];
  const invalidates: string[] = [];

  if (regime === "TRENDING_BULL") {
    confirms.push(
      "Price holding above EMA20 and EMA50",
      "EMA20 stays above EMA50",
      "RSI holds above 50",
      "Pullbacks show buyers stepping in"
    );
    invalidates.push(
      "4H close back below EMA50",
      "RSI loses bullish structure",
      "Volume fades on push higher",
      "Trend starts failing at prior highs"
    );
  }

  if (regime === "TRENDING_BEAR") {
    confirms.push(
      "Price holding below EMA20 and EMA50",
      "EMA20 stays below EMA50",
      "RSI remains weak below 50",
      "Bounces get sold quickly"
    );
    invalidates.push(
      "4H close back above EMA50",
      "RSI reclaims bullish structure",
      "Sellers fail to continue lower",
      "Breakdown loses momentum"
    );
  }

  if (regime === "RANGE") {
    confirms.push(
      "Price keeps rotating around mid-range",
      "EMA structure stays mixed",
      "RSI remains neutral",
      "No clean trend continuation"
    );
    invalidates.push(
      "Strong breakout with volume",
      "Trend strength expands sharply",
      "Price cleanly leaves range and holds",
      "EMA structure begins separating"
    );
  }

  if (regime === "BREAKOUT_WATCH") {
    confirms.push(
      "Compression continues without breakdown",
      "Volume starts expanding",
      "Price pushes out of tight structure",
      "Follow-through candle confirms breakout"
    );
    invalidates.push(
      "Fake breakout and immediate rejection",
      "Volume remains weak",
      "Price falls back into compression",
      "EMAs remain flat and messy"
    );
  }

  if (regime === "TRANSITION") {
    confirms.push(
      "One side starts holding control",
      "EMA structure becomes cleaner",
      "Momentum confirms direction",
      "Follow-through appears after reclaim/break"
    );
    invalidates.push(
      "Mixed closes with no continuation",
      "Price keeps whipping around EMAs",
      "RSI stays indecisive",
      "No clear directional acceptance"
    );
  }

  return {
    regime,
    confidence,
    directionBias,
    tradeCondition,
    bullScore,
    bearScore,
    rangeScore,
    breakoutScore,
    summary,
    operatorNote,
    confirms,
    invalidates,
  };
}
