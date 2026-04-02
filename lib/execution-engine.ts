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
  longEntryQuality: 'EARLY' | 'GOOD' | 'LATE' | 'CHASE'
  shortEntryQuality: 'EARLY' | 'GOOD' | 'LATE' | 'CHASE'
  longChaseWarning: string
  shortChaseWarning: string
  bestEntrySide: 'LONG' | 'SHORT' | 'WAIT'
  entryComment: string
  longTriggerState: 'WATCH' | 'TRIGGERING' | 'CONFIRMED' | 'FAILED'
  shortTriggerState: 'WATCH' | 'TRIGGERING' | 'CONFIRMED' | 'FAILED'
  longConfirmationScore: number
  shortConfirmationScore: number
  bestActiveTrigger: 'LONG' | 'SHORT' | 'WAIT'
  triggerComment: string
  triggerFailureWarning: string
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}


function classifyEntryQuality(score: number) {
  if (score >= 75) return 'GOOD' as const
  if (score >= 60) return 'EARLY' as const
  if (score >= 45) return 'LATE' as const
  return 'CHASE' as const
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

  let longEntryBase = 50
  let shortEntryBase = 50

  if (preferredSide === 'LONG') longEntryBase += 18
  if (preferredSide === 'SHORT') shortEntryBase += 18
  if (price > ema20) longEntryBase += 10
  else shortEntryBase += 10
  if (price > ema50) longEntryBase += 8
  else shortEntryBase += 8
  if (macdHist > 0) longEntryBase += 8
  else shortEntryBase += 8
  if (rsi >= 52 && rsi <= 68) longEntryBase += 10
  else if (rsi > 72) longEntryBase -= 14
  if (rsi >= 32 && rsi <= 48) shortEntryBase += 10
  else if (rsi < 28) shortEntryBase -= 14
  if (!canTradeNow) {
    longEntryBase -= 10
    shortEntryBase -= 10
  }
  if (tradeReadiness < 60) {
    longEntryBase -= 8
    shortEntryBase -= 8
  }

  const longEntryQuality = classifyEntryQuality(clamp(Math.round(longEntryBase)))
  const shortEntryQuality = classifyEntryQuality(clamp(Math.round(shortEntryBase)))

  const longChaseWarning =
    longEntryQuality === 'CHASE'
      ? 'Long is stretched. Avoid chasing strength far from value.'
      : longEntryQuality === 'LATE'
      ? 'Long is getting extended. Better entry usually comes on pullback.'
      : longEntryQuality === 'EARLY'
      ? 'Long structure is improving, but confirmation is still developing.'
      : 'Long entry quality is acceptable if price reacts cleanly.'

  const shortChaseWarning =
    shortEntryQuality === 'CHASE'
      ? 'Short is stretched. Avoid forcing new shorts too close to target.'
      : shortEntryQuality === 'LATE'
      ? 'Short is already moving. Better entry usually comes on rejection.'
      : shortEntryQuality === 'EARLY'
      ? 'Short structure is improving, but confirmation is still developing.'
      : 'Short entry quality is acceptable if price rejects cleanly.'

  const bestEntrySide: 'LONG' | 'SHORT' | 'WAIT' =
    preferredSide === 'LONG' && (longEntryQuality === 'GOOD' || longEntryQuality === 'EARLY')
      ? 'LONG'
      : preferredSide === 'SHORT' && (shortEntryQuality === 'GOOD' || shortEntryQuality === 'EARLY')
      ? 'SHORT'
      : 'WAIT'

  const entryComment =
    bestEntrySide === 'LONG'
      ? longEntryQuality === 'GOOD'
        ? 'Long is in a tradable area. Prefer confirmation over chasing.'
        : 'Long bias exists, but the cleaner entry is still forming.'
      : bestEntrySide === 'SHORT'
      ? shortEntryQuality === 'GOOD'
        ? 'Short is in a tradable area. Prefer rejection over forcing.'
        : 'Short bias exists, but the cleaner entry is still forming.'
      : preferredSide === 'NEUTRAL'
      ? 'No side has a clean entry edge right now. Waiting is better than forcing.'
      : 'Directional bias exists, but current entry quality is too weak or too stretched.'


  const longTriggerState: 'WATCH' | 'TRIGGERING' | 'CONFIRMED' | 'FAILED' =
    preferredSide !== 'LONG'
      ? 'WATCH'
      : longEntryQuality === 'GOOD'
      ? 'TRIGGERING'
      : longEntryQuality === 'EARLY'
      ? 'WATCH'
      : longEntryQuality === 'LATE'
      ? 'CONFIRMED'
      : 'FAILED'

  const shortTriggerState: 'WATCH' | 'TRIGGERING' | 'CONFIRMED' | 'FAILED' =
    preferredSide !== 'SHORT'
      ? 'WATCH'
      : shortEntryQuality === 'GOOD'
      ? 'TRIGGERING'
      : shortEntryQuality === 'EARLY'
      ? 'WATCH'
      : shortEntryQuality === 'LATE'
      ? 'CONFIRMED'
      : 'FAILED'

  const longConfirmationScore = clamp(
    Math.round(
      longScore * 0.45 +
        tradeReadiness * 0.2 +
        smartEdge * 0.15 +
        (longEntryQuality === 'GOOD' ? 18 : longEntryQuality === 'LATE' ? 8 : 0)
    )
  )

  const shortConfirmationScore = clamp(
    Math.round(
      shortScore * 0.45 +
        tradeReadiness * 0.2 +
        smartEdge * 0.15 +
        (shortEntryQuality === 'GOOD' ? 18 : shortEntryQuality === 'LATE' ? 8 : 0)
    )
  )

  const bestActiveTrigger: 'LONG' | 'SHORT' | 'WAIT' =
    longTriggerState === 'CONFIRMED'
      ? 'LONG'
      : shortTriggerState === 'CONFIRMED'
      ? 'SHORT'
      : longTriggerState === 'TRIGGERING' && longConfirmationScore >= shortConfirmationScore
      ? 'LONG'
      : shortTriggerState === 'TRIGGERING' && shortConfirmationScore > longConfirmationScore
      ? 'SHORT'
      : 'WAIT'

  const triggerComment =
    bestActiveTrigger === 'LONG'
      ? longTriggerState === 'CONFIRMED'
        ? 'Long trigger quality is confirmed. Price is not just attractive, it is reacting.'
        : 'Long trigger is forming. Wait for bullish follow-through, not just a touch.'
      : bestActiveTrigger === 'SHORT'
      ? shortTriggerState === 'CONFIRMED'
        ? 'Short trigger quality is confirmed. Price is not just attractive, it is rejecting.'
        : 'Short trigger is forming. Wait for bearish follow-through, not just a touch.'
      : 'No trigger is confirmed right now. Watching is better than forcing execution.'

  const triggerFailureWarning =
    longTriggerState === 'FAILED'
      ? 'Long trigger failed. Price is too stretched or momentum did not confirm.'
      : shortTriggerState === 'FAILED'
      ? 'Short trigger failed. Price is too stretched or momentum did not confirm.'
      : 'Main risk is a weak touch without real confirmation. Avoid acting on a shallow reaction.'


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
    longEntryQuality,
    shortEntryQuality,
    longChaseWarning,
    shortChaseWarning,
    bestEntrySide,
    entryComment,
    longTriggerState,
    shortTriggerState,
    longConfirmationScore,
    shortConfirmationScore,
    bestActiveTrigger,
    triggerComment,
    triggerFailureWarning,
  }
}
