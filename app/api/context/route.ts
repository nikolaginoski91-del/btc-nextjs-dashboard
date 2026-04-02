import { NextResponse } from 'next/server'
import { calculateExecution } from '@/lib/execution-engine'

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
]

async function safeJson(url: string) {
  const res = await fetch(url, {
    cache: 'no-store',
    next: { revalidate: 0 },
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  return res.json()
}

async function safeJsonOrNull(url: string) {
  try {
    return await safeJson(url)
  } catch {
    return null
  }
}

function getCloses(klines: BinanceKline[]) {
  return klines.map((k) => Number(k[4]))
}

function calculateEMA(values: number[], period: number) {
  if (!values.length) return 0
  if (values.length < period) return values[values.length - 1] ?? 0

  const multiplier = 2 / (period + 1)
  let ema = values[0]

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * multiplier + ema * (1 - multiplier)
  }

  return ema
}

function calculateRSI(values: number[], period = 14) {
  if (values.length < period + 1) return 50

  let gains = 0
  let losses = 0

  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gains += diff
    else losses += Math.abs(diff)
  }

  if (losses === 0) return 100

  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

function calculateMACD(values: number[]) {
  if (values.length < 35) {
    return { macd: 0, signal: 0, hist: 0 }
  }

  const ema12Series: number[] = []
  const ema26Series: number[] = []

  for (let i = 0; i < values.length; i++) {
    const slice = values.slice(0, i + 1)
    ema12Series.push(calculateEMA(slice, 12))
    ema26Series.push(calculateEMA(slice, 26))
  }

  const macdSeries = ema12Series.map((ema12, i) => ema12 - ema26Series[i])
  const signal = calculateEMA(macdSeries, 9)
  const macd = macdSeries[macdSeries.length - 1] ?? 0
  const hist = macd - signal

  return { macd, signal, hist }
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function round2(value: number) {
  return Number(value.toFixed(2))
}

export async function GET() {
  try {
    const [btc24h, ethusd, btcKlines] = await Promise.all([
      safeJsonOrNull('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
      safeJsonOrNull('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
      safeJsonOrNull('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=220'),
    ])

    if (!btcKlines || !Array.isArray(btcKlines) || btcKlines.length < 50) {
      throw new Error('BTC klines unavailable')
    }

    const closes = getCloses(btcKlines as BinanceKline[])
    const price =
      Number((btc24h as any)?.lastPrice ?? 0) || Number(closes[closes.length - 1] ?? 0)

    const ema20 = calculateEMA(closes.slice(-40), 20)
    const ema50 = calculateEMA(closes.slice(-100), 50)
    const ema200 = calculateEMA(closes, 200)
    const rsi = calculateRSI(closes, 14)
    const macdData = calculateMACD(closes)
    const macdHist = macdData.hist

    const priceChangePercent = Number((btc24h as any)?.priceChangePercent ?? 0)

    const trendBullish = price > ema20 && ema20 > ema50
    const trendBearish = price < ema20 && ema20 < ema50

    const canTradeNow =
      Math.abs(priceChangePercent) >= 0.35 || Math.abs(macdHist) > 15 || rsi > 55 || rsi < 45

    let tradeReadiness = 50

    if (trendBullish || trendBearish) tradeReadiness += 15
    if (price > ema20 || price < ema20) tradeReadiness += 5
    if (Math.abs(macdHist) > 10) tradeReadiness += 10
    if ((rsi >= 52 && rsi <= 68) || (rsi >= 32 && rsi <= 48)) tradeReadiness += 10
    if (Math.abs(priceChangePercent) >= 1) tradeReadiness += 5

    tradeReadiness = clamp(Math.round(tradeReadiness))

    let smartEdge = 50

    if (trendBullish || trendBearish) smartEdge += 15
    if (Math.abs(macdHist) > 20) smartEdge += 10
    if (price > ema50 || price < ema50) smartEdge += 10
    if (tradeReadiness >= 70) smartEdge += 10

    smartEdge = clamp(Math.round(smartEdge))

    const execution = calculateExecution({
      price,
      ema20,
      ema50,
      ema200,
      rsi,
      macdHist,
      tradeReadiness,
      smartEdge,
      canTradeNow,
    })

    const spy =
      btc24h && typeof (btc24h as any).priceChangePercent !== 'undefined'
        ? `${Number((btc24h as any).priceChangePercent).toFixed(2)}%`
        : 'Unavailable'

    const ethbtc =
      ethusd && typeof (ethusd as any).price !== 'undefined'
        ? `$${Number((ethusd as any).price).toFixed(2)}`
        : 'Unavailable'

    return NextResponse.json({
      dxy: 'Context enabled',
      spy,
      ethbtc,

      price: round2(price),
      ema20: round2(ema20),
      ema50: round2(ema50),
      ema200: round2(ema200),
      rsi: round2(rsi),
      macdHist: round2(macdHist),

      canTradeNow,
      tradeReadiness,
      smartEdge,

      longExecution: execution.longExecution,
      shortExecution: execution.shortExecution,
      preferredSide: execution.preferredSide,
      executionComment: execution.executionComment,
      longReasons: execution.longReasons,
      shortReasons: execution.shortReasons,
      whyLong: execution.whyLong,
      whyShort: execution.whyShort,
      longConfirmations: execution.longConfirmations,
      shortConfirmations: execution.shortConfirmations,
      longInvalidations: execution.longInvalidations,
      shortInvalidations: execution.shortInvalidations,
      avoidTradeReason: execution.avoidTradeReason,
      longEntryQuality: execution.longEntryQuality,
      shortEntryQuality: execution.shortEntryQuality,
      longChaseWarning: execution.longChaseWarning,
      shortChaseWarning: execution.shortChaseWarning,
      bestEntrySide: execution.bestEntrySide,
      entryComment: execution.entryComment,
      longTriggerState: execution.longTriggerState,
      shortTriggerState: execution.shortTriggerState,
      longConfirmationScore: execution.longConfirmationScore,
      shortConfirmationScore: execution.shortConfirmationScore,
      bestActiveTrigger: execution.bestActiveTrigger,
      triggerComment: execution.triggerComment,
      triggerFailureWarning: execution.triggerFailureWarning,
    })
  } catch (error) {
    console.error('Context API error:', error)

    return NextResponse.json(
      {
        dxy: 'Context error',
        spy: 'Unavailable',
        ethbtc: 'Unavailable',

        price: 0,
        ema20: 0,
        ema50: 0,
        ema200: 0,
        rsi: 50,
        macdHist: 0,

        canTradeNow: false,
        tradeReadiness: 35,
        smartEdge: 35,

        longExecution: 35,
        shortExecution: 35,
        preferredSide: 'NEUTRAL',
        executionComment: 'Context data unavailable right now.',
        longReasons: ['Data unavailable'],
        shortReasons: ['Data unavailable'],
        whyLong: ['Data unavailable'],
        whyShort: ['Data unavailable'],
        longConfirmations: ['Data unavailable'],
        shortConfirmations: ['Data unavailable'],
        longInvalidations: ['Data unavailable'],
        shortInvalidations: ['Data unavailable'],
        avoidTradeReason: 'Avoid trading until context data returns.',
        longEntryQuality: 'LATE',
        shortEntryQuality: 'LATE',
        longChaseWarning: 'Data unavailable',
        shortChaseWarning: 'Data unavailable',
        bestEntrySide: 'WAIT',
        entryComment: 'Entry quality unavailable while context data is down.',
        longTriggerState: 'WATCH',
        shortTriggerState: 'WATCH',
        longConfirmationScore: 0,
        shortConfirmationScore: 0,
        bestActiveTrigger: 'WAIT',
        triggerComment: 'Trigger quality unavailable while context data is down.',
        triggerFailureWarning: 'Wait for context data before acting on any trigger.',
      },
      { status: 200 }
    )
  }
}
