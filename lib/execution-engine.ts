// src/lib/execution-engine.ts

export type ExecutionInputs = {
  price: number
  ema20: number
  ema50: number
  ema200: number
  rsi: number
  macdHist: number
  tradeReadiness: number
  smartEdge: number
  canTradeNow: boolean
}

export type ExecutionOutput = {
  longExecution: number
  shortExecution: number
  preferredSide: 'LONG' | 'SHORT' | 'NEUTRAL'
  executionComment: string
  longReasons: string[]
  shortReasons: string[]
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

export function calculateExecution(inputs: ExecutionInputs): ExecutionOutput {
  const {
    price,
    ema20,
    ema50,
    ema200,
    rsi,
    macdHist,
    tradeReadiness,
    smartEdge,
    canTradeNow,
  } = inputs

  let longScore = 50
  let shortScore = 50

  const longReasons: string[] = []
  const shortReasons: string[] = []

  // 1) Trade window quality
  if (!canTradeNow) {
    longScore -= 12
    shortScore -= 12
    longReasons.push('Trade window is not ideal right now')
    shortReasons.push('Trade window is not ideal right now')
  }

  // 2) Trend alignment
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
    longScore += 18
    shortScore -= 12
    longReasons.push('Bullish trend alignment')
  } else if (price < ema20 && ema20 < ema50 && ema50 < ema200) {
    shortScore += 18
    longScore -= 12
    shortReasons.push('Bearish trend alignment')
  } else {
    longScore -= 4
    shortScore -= 4
    longReasons.push('Trend not fully aligned')
    shortReasons.push('Trend not fully aligned')
  }

  // 3) Price location
  if (price > ema20) {
    longScore += 6
    longReasons.push('Price above short-term trend')
  } else {
    shortScore += 6
    shortReasons.push('Price below short-term trend')
  }

  if (price > ema50) {
    longScore += 6
    longReasons.push('Price above medium-term trend')
  } else {
    shortScore += 6
    shortReasons.push('Price below medium-term trend')
  }

  // 4) RSI
  if (rsi >= 52 && rsi <= 68) {
    longScore += 10
    longReasons.push('RSI supports bullish continuation')
  } else if (rsi > 72) {
    longScore -= 6
    shortScore += 4
    longReasons.push('RSI slightly overheated')
    shortReasons.push('Overbought conditions can help shorts')
  }

  if (rsi >= 32 && rsi <= 48) {
    shortScore += 10
    shortReasons.push('RSI supports bearish continuation')
  } else if (rsi < 28) {
    shortScore -= 6
    longScore += 4
    shortReasons.push('RSI deeply oversold')
    longReasons.push('Oversold bounce risk for shorts')
  }

  // 5) MACD histogram
  if (macdHist > 0) {
    longScore += 10
    shortScore -= 5
    longReasons.push('Positive momentum')
  } else if (macdHist < 0) {
    shortScore += 10
    longScore -= 5
    shortReasons.push('Negative momentum')
  }

  // 6) Readiness
  if (tradeReadiness >= 75) {
    longScore += 8
    shortScore += 8
  } else if (tradeReadiness < 45) {
    longScore -= 8
    shortScore -= 8
    longReasons.push('Low readiness reduces conviction')
    shortReasons.push('Low readiness reduces conviction')
  }

  // 7) Smart edge
  if (smartEdge >= 70) {
    longScore += 6
    shortScore += 6
  } else if (smartEdge < 45) {
    longScore -= 6
    shortScore -= 6
    longReasons.push('Low edge quality')
    shortReasons.push('Low edge quality')
  }

  // 8) Signal stack
  const bullishStack =
    Number(price > ema20) +
    Number(price > ema50) +
    Number(macdHist > 0) +
    Number(rsi >= 52)

  const bearishStack =
    Number(price < ema20) +
    Number(price < ema50) +
    Number(macdHist < 0) +
    Number(rsi <= 48)

  if (bullishStack >= 3) {
    longScore += 8
    shortScore -= 6
    longReasons.push('Multiple bullish signals aligned')
  }

  if (bearishStack >= 3) {
    shortScore += 8
    longScore -= 6
    shortReasons.push('Multiple bearish signals aligned')
  }

  longScore = clamp(Math.round(longScore))
  shortScore = clamp(Math.round(shortScore))

  let preferredSide: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL'
  let executionComment = 'Market is mixed. Better to wait for cleaner alignment.'

  const diff = Math.abs(longScore - shortScore)

  if (longScore >= 60 && longScore > shortScore && diff >= 8) {
    preferredSide = 'LONG'
    executionComment = 'Long side has better alignment right now.'
  } else if (shortScore >= 60 && shortScore > longScore && diff >= 8) {
    preferredSide = 'SHORT'
    executionComment = 'Short side has better alignment right now.'
  } else if (longScore >= 70 && shortScore < 50) {
    preferredSide = 'LONG'
    executionComment = 'Strong long execution setup.'
  } else if (shortScore >= 70 && longScore < 50) {
    preferredSide = 'SHORT'
    executionComment = 'Strong short execution setup.'
  }

  return {
    longExecution: longScore,
    shortExecution: shortScore,
    preferredSide,
    executionComment,
    longReasons: longReasons.slice(0, 4),
    shortReasons: shortReasons.slice(0, 4),
  }
}