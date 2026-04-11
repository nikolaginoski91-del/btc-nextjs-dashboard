export type TimeframeBias = "bullish" | "bearish" | "neutral";

export type AlignmentState =
  | "strong_bullish"
  | "bullish"
  | "mixed"
  | "bearish"
  | "strong_bearish";

export interface TimeframeRead {
  timeframe: "4H" | "1D" | "1W";
  bias: TimeframeBias;
  score: number;
  reason: string;
}

export interface MultiTimeframeAlignment {
  weekly: TimeframeRead;
  daily: TimeframeRead;
  fourHour: TimeframeRead;
  alignment: AlignmentState;
  longAllowed: boolean;
  shortAllowed: boolean;
  confidence: number;
  summary: string;
}

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

function scoreToBias(score: number): TimeframeBias {
  if (score >= 20) return "bullish";
  if (score <= -20) return "bearish";
  return "neutral";
}

function explainBias(tf: "4H" | "1D" | "1W", score: number, bias: TimeframeBias) {
  if (bias === "bullish") {
    return `${tf} structure is leaning bullish`;
  }

  if (bias === "bearish") {
    return `${tf} structure is leaning bearish`;
  }

  return `${tf} structure is neutral / mixed`;
}

export interface RawTimeframeInputs {
  emaFast: number;
  emaSlow: number;
  price: number;
  rsi: number;
}

export function buildTimeframeRead(
  timeframe: "4H" | "1D" | "1W",
  input: RawTimeframeInputs
): TimeframeRead {
  let score = 0;

  // Trend filter
  if (input.emaFast > input.emaSlow) score += 35;
  if (input.emaFast < input.emaSlow) score -= 35;

  // Price location
  if (input.price > input.emaFast) score += 20;
  if (input.price < input.emaFast) score -= 20;

  // RSI filter
  if (input.rsi >= 55) score += 15;
  if (input.rsi <= 45) score -= 15;

  score = clamp(score, -100, 100);

  const bias = scoreToBias(score);

  return {
    timeframe,
    bias,
    score,
    reason: explainBias(timeframe, score, bias),
  };
}

export function buildMultiTimeframeAlignment(params: {
  weekly: RawTimeframeInputs;
  daily: RawTimeframeInputs;
  fourHour: RawTimeframeInputs;
}): MultiTimeframeAlignment {
  const weekly = buildTimeframeRead("1W", params.weekly);
  const daily = buildTimeframeRead("1D", params.daily);
  const fourHour = buildTimeframeRead("4H", params.fourHour);

  const weightedScore =
    weekly.score * 0.45 +
    daily.score * 0.35 +
    fourHour.score * 0.2;

  let alignment: AlignmentState = "mixed";

  if (weightedScore >= 55) alignment = "strong_bullish";
  else if (weightedScore >= 20) alignment = "bullish";
  else if (weightedScore <= -55) alignment = "strong_bearish";
  else if (weightedScore <= -20) alignment = "bearish";

  const higherTfBullish =
    weekly.bias === "bullish" && daily.bias === "bullish";

  const higherTfBearish =
    weekly.bias === "bearish" && daily.bias === "bearish";

  const longAllowed =
    higherTfBullish || (daily.bias === "bullish" && fourHour.bias === "bullish");

  const shortAllowed =
    higherTfBearish || (daily.bias === "bearish" && fourHour.bias === "bearish");

  const confidence = clamp(Math.round(Math.abs(weightedScore)), 0, 100);

  let summary = "Timeframes are mixed. Execution should be selective.";

  if (alignment === "strong_bullish") {
    summary = "Weekly, daily, and lower timeframe are aligned bullish. Longs are favored.";
  } else if (alignment === "bullish") {
    summary = "Higher timeframe bias is bullish, but lower timeframe confirmation still matters.";
  } else if (alignment === "strong_bearish") {
    summary = "Weekly, daily, and lower timeframe are aligned bearish. Shorts are favored.";
  } else if (alignment === "bearish") {
    summary = "Higher timeframe bias is bearish, but lower timeframe confirmation still matters.";
  }

  return {
    weekly,
    daily,
    fourHour,
    alignment,
    longAllowed,
    shortAllowed,
    confidence,
    summary,
  };
}