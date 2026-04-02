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
  whyLong: string[]
  whyShort: string[]
  longConfirmations: string[]
  shortConfirmations: string[]
  longInvalidations: string[]
  shortInvalidations: string[]
  avoidTradeReason: string
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

  if (!canTradeNow) {
    longScore -= 12
    shortScore -= 12
    longReasons.push('Trade window is not ideal right now')
    shortReasons.push('Trade window is not ideal right now')
  }

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

  if (macdHist > 0) {
    longScore += 10
    shortScore -= 5
    longReasons.push('Positive momentum')
  } else if (macdHist < 0) {
    shortScore += 10
    longScore -= 5
    shortReasons.push('Negative momentum')
  }

  if (tradeReadiness >= 75) {
    longScore += 8
    shortScore += 8
  } else if (tradeReadiness < 45) {
    longScore -= 8
    shortScore -= 8
    longReasons.push('Low readiness reduces conviction')
    shortReasons.push('Low readiness reduces conviction')
  }

  if (smartEdge >= 70) {
    longScore += 6
    shortScore += 6
  } else if (smartEdge < 45) {
    longScore -= 6
    shortScore -= 6
    longReasons.push('Low edge quality')
    shortReasons.push('Low edge quality')
  }

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

  const whyLong = [
    price > ema20 ? 'Price is holding above EMA20.' : 'Price is not above EMA20 yet.',
    price > ema50 ? 'Price is holding above EMA50.' : 'Price is not above EMA50 yet.',
    macdHist > 0 ? 'MACD histogram is positive.' : 'MACD histogram is not positive.',
    rsi >= 52 && rsi <= 68 ? 'RSI is in bullish continuation zone.' : 'RSI is not in ideal bullish continuation zone.',
  ]

  const whyShort = [
    price < ema20 ? 'Price is holding below EMA20.' : 'Price is not below EMA20 yet.',
    price < ema50 ? 'Price is holding below EMA50.' : 'Price is not below EMA50 yet.',
    macdHist < 0 ? 'MACD histogram is negative.' : 'MACD histogram is not negative.',
    rsi >= 32 && rsi <= 48 ? 'RSI is in bearish continuation zone.' : 'RSI is not in ideal bearish continuation zone.',
  ]

  const longConfirmations = [
    `Hold above EMA20 (${ema20.toFixed(0)}).`,
    `Hold above EMA50 (${ema50.toFixed(0)}).`,
    macdHist > 0 ? 'Keep MACD histogram positive.' : 'Need MACD histogram to flip positive.',
    rsi >= 50 ? 'Keep RSI above 50.' : 'Need RSI to reclaim above 50.',
  ]

  const shortConfirmations = [
    `Stay below EMA20 (${ema20.toFixed(0)}).`,
    `Stay below EMA50 (${ema50.toFixed(0)}).`,
    macdHist < 0 ? 'Keep MACD histogram negative.' : 'Need MACD histogram to flip negative.',
    rsi <= 50 ? 'Keep RSI below 50.' : 'Need RSI to lose 50 again.',
  ]

  const longInvalidations = [
    `Lose EMA20 (${ema20.toFixed(0)}).`,
    `Lose EMA50 (${ema50.toFixed(0)}).`,
    'Momentum flips against longs.',
    'Bullish follow-through fails after trigger.',
  ]

  const shortInvalidations = [
    `Reclaim EMA20 (${ema20.toFixed(0)}).`,
    `Reclaim EMA50 (${ema50.toFixed(0)}).`,
    'Momentum flips against shorts.',
    'Bearish follow-through fails after trigger.',
  ]

  const avoidTradeReason =
    preferredSide === 'NEUTRAL'
      ? 'Signals are mixed. Avoid trading in the middle until one side clearly takes control.'
      : !canTradeNow
      ? 'Directional bias exists, but the current trade window is still low quality.'
      : tradeReadiness < 60
      ? 'Bias exists, but readiness is still too weak for clean execution.'
      : 'Avoid chasing if price stretches too far from the best entry area.'

  return {
    longExecution: longScore,
    shortExecution: shortScore,
    preferredSide,
    executionComment,
    longReasons: longReasons.slice(0, 4),
    shortReasons: shortReasons.slice(0, 4),
    whyLong,
    whyShort,
    longConfirmations,
    shortConfirmations,
    longInvalidations,
    shortInvalidations,
    avoidTradeReason,
  }
}
