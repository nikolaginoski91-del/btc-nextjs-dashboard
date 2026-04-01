'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { buildStateFromCandles, FALLBACK_CANDLES, fmt } from '@/lib/market';
import {
  DashboardState,
  LiveMode,
  SignalCard,
  Timeframe,
  ExecutionTone,
  ExecutionLocation,
} from '@/lib/types';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export default function DashboardClient() {
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [mode, setMode] = useState<LiveMode>('fallback');
  const [errorText, setErrorText] = useState('');
  const [activeSignal, setActiveSignal] = useState<SignalCard | null>(null);
  const [tab, setTab] = useState<'overview' | 'signals' | 'calendar'>('overview');
  const [state, setState] = useState<DashboardState>(() =>
  buildStateFromCandles(FALLBACK_CANDLES['4h'], 'Loading...')
);

  const visibleCandles = useMemo(() => state.candles.slice(-60), [state.candles]);
  const primarySignal = state.signals[0] ?? null;

  async function loadLive() {
    setMode('loading');
    setErrorText('');

    try {
      const [btcRes, ctxRes] = await Promise.allSettled([
        fetch(`/api/btc?tf=${encodeURIComponent(timeframe)}`, { cache: 'no-store' }),
        fetch('/api/context', { cache: 'no-store' }),
      ]);

      if (btcRes.status !== 'fulfilled' || !btcRes.value.ok) {
        throw new Error(
          `BTC route failed${btcRes.status === 'fulfilled' ? ` (${btcRes.value.status})` : ''}`
        );
      }

      const btcJson = await btcRes.value.json();
      const ctxJson =
        ctxRes.status === 'fulfilled' && ctxRes.value.ok ? await ctxRes.value.json() : {};

      const nextState = buildStateFromCandles(
        btcJson.candles,
        new Date().toLocaleString(),
        ctxJson
      );

      setState(nextState);
      setActiveSignal(nextState.signals[0] ?? null);
      setMode(btcJson.source === 'coingecko' ? 'live-coingecko' : 'live-binance');
    } catch (error) {
      setMode('failed');
      setErrorText(error instanceof Error ? error.message : 'Unknown live fetch error');
    }
  }

 useEffect(() => {
  const fallbackState = buildStateFromCandles(
    FALLBACK_CANDLES[timeframe],
    new Date().toLocaleString()
  );

  setState(fallbackState);
  setActiveSignal(fallbackState.signals[0] ?? null);
  void loadLive();
}, [timeframe]);

  const rrLong =
    ((state.longTargets[1] ?? state.longTargets[0]) - state.longEntry[1]) /
    Math.max(state.longEntry[1] - state.longStop, 1);

  const rrShort =
    (state.shortEntry[0] - (state.shortTargets[1] ?? state.shortTargets[0])) /
    Math.max(state.shortStop - state.shortEntry[0], 1);

  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      (state.confidence === 'high' ? 30 : state.confidence === 'medium' ? 20 : 10) +
        (state.trendState === 'uptrend' || state.trendState === 'downtrend' ? 25 : 10) +
        (primarySignal?.strength === 'high' ? 25 : primarySignal?.strength === 'medium' ? 15 : 5) +
        (state.execution.longQuality > 70 || state.execution.shortQuality > 70 ? 20 : 10)
    )
  );

  const tradeAction =
    readinessScore > 70
      ? state.bias === 'bullish'
        ? 'LOOK FOR LONG'
        : state.bias === 'bearish'
        ? 'LOOK FOR SHORT'
        : 'WAIT'
      : readinessScore > 50
      ? 'SETUP FORMING'
      : 'WAIT';

  const tradeEdge =
    readinessScore > 75 ? 'STRONG' : readinessScore > 55 ? 'MEDIUM' : 'WEAK';

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <div
            className="small"
            style={{ color: 'var(--neutral)', textTransform: 'uppercase', letterSpacing: '.22em' }}
          >
            Hosted build for Vercel / Netlify
          </div>
          <h1 style={{ margin: '8px 0', fontSize: 'clamp(28px, 5vw, 52px)' }}>
            BTC/USDT Live Dashboard
          </h1>
          <div className="muted">
            This version is built for a real web origin so live requests work on iPhone and laptop.
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <div className="switcher">
            {(['15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                className={timeframe === tf ? 'active' : ''}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>

          <button className="primary-btn" onClick={loadLive}>
            <RefreshCw size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Refresh Live Data
          </button>

          <StatusBadge mode={mode} />
        </div>
      </div>

      <div className="card section">
        <div className="space-between">
          <h2 style={{ margin: 0 }}>Trade Readiness</h2>
          <span
            className={`badge ${
              tradeEdge === 'STRONG' ? 'bullish' : tradeEdge === 'MEDIUM' ? 'neutral' : 'warn'
            }`}
          >
            {tradeEdge}
          </span>
        </div>

        <div className="metric-grid four" style={{ marginTop: 16 }}>
          <Metric label="Score" value={`${readinessScore}/100`} />
          <Metric label="Action" value={tradeAction} />
          <Metric label="Bias" value={state.bias} />
          <Metric label="Trend" value={state.trendState} />
        </div>

        <div className="metric" style={{ marginTop: 12 }}>
          <div className="label">Operator Read</div>
          <div className="value">
            {tradeAction === 'WAIT'
              ? 'No strong edge right now. Best decision is patience.'
              : tradeAction === 'SETUP FORMING'
              ? 'Conditions are improving, but confirmation is still needed.'
              : state.bias === 'bullish'
              ? 'Focus on long setups with confirmation and pullbacks into value.'
              : 'Focus on short setups with confirmation and rejection into resistance.'}
          </div>
        </div>
      </div>

      <div className="hero">
        <div className="card">
          <div className="space-between">
            <h2 style={{ margin: 0 }}>Live Price</h2>
            <StatusDelta change={state.change24h} />
          </div>

          <div className="big-price">${fmt(state.price, 2)}</div>

          <div className="metric-grid four" style={{ marginTop: 16 }}>
            <Metric label="24H High" value={`$${fmt(state.high24h, 2)}`} />
            <Metric label="24H Low" value={`$${fmt(state.low24h, 2)}`} />
            <Metric label="24H Volume" value={fmt(state.volume24h, 0)} />
            <Metric label="Updated" value={mode === 'loading' ? 'Loading...' : state.updatedAt} />
          </div>
        </div>

        <div className="card">
          <div className="space-between">
            <h2 style={{ margin: 0 }}>Bias</h2>
            <span className={`badge ${state.bias}`}>{state.bias.toUpperCase()}</span>
          </div>

          <div className="metric-grid two" style={{ marginTop: 16 }}>
            <Metric label="Confidence" value={state.confidence} />
            <Metric label="Structure" value={state.structure} />
            <Metric label="Trend State" value={state.trendState} />
            <Metric label="Bias Flip" value={`$${fmt(state.biasFlipLevel, 0)}`} />
          </div>

          <div className="metric" style={{ marginTop: 12 }}>
            <div className="value">
              Bias flips if price invalidates current structure and retakes the other side of EMA50
              with follow-through.
            </div>
          </div>
        </div>
      </div>


      <div
        className="grid section"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Execution Summary</h2>
          <div className="metric-grid two" style={{ marginTop: 16 }}>
            <Metric label="Market Bias" value={state.bias.toUpperCase()} />
            <Metric
              label="Best Action"
              value={
                state.execution.longTone === 'good'
                  ? 'Look for Long'
                  : state.execution.shortTone === 'good'
                  ? 'Look for Short'
                  : 'Wait / No Clean Setup'
              }
            />
            <Metric
              label="Long Zone"
              value={`${fmt(state.longEntry[0], 0)} - ${fmt(state.longEntry[1], 0)}`}
            />
            <Metric
              label="Short Zone"
              value={`${fmt(state.shortEntry[0], 0)} - ${fmt(state.shortEntry[1], 0)}`}
            />
            <Metric
              label="Risk Mode"
              value={
                state.execution.longRiskState === 'high-risk' ||
                state.execution.shortRiskState === 'high-risk'
                  ? 'High Risk'
                  : 'Controlled'
              }
            />
            <Metric
              label="Trade Type"
              value={
                primarySignal?.type === 'confirmed-long' ||
                primarySignal?.type === 'confirmed-short'
                  ? 'Confirmation Entry'
                  : primarySignal?.type === 'aggressive-long' ||
                    primarySignal?.type === 'aggressive-short'
                  ? 'Aggressive Entry'
                  : 'Patience / Wait'
              }
            />
            <Metric label="Confidence" value={state.confidence} />
            <Metric label="Trend State" value={state.trendState} />
          </div>

          <div className="metric" style={{ marginTop: 12 }}>
            <div className="label">Operator Note</div>
            <div className="value">
              {state.bias === 'bullish'
                ? 'Prefer longs on pullback and confirmation. Avoid chasing into resistance.'
                : state.bias === 'bearish'
                ? 'Prefer shorts on rejection and weakness. Avoid forcing longs into pressure.'
                : 'Market is mixed. Best edge comes from patience and confirmation.'}
            </div>
          </div>
        </div>
      </div>

      {primarySignal ? (
        <div className="card section" style={{ padding: 18 }}>
          <div className="space-between" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div
                className="small"
                style={{
                  color: 'var(--neutral)',
                  textTransform: 'uppercase',
                  letterSpacing: '.18em',
                }}
              >
                Primary live signal
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                {primarySignal.title}
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                {primarySignal.note}
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <SignalTypeBadge type={primarySignal.type} />
              <StrengthBadge strength={primarySignal.strength} />
              <span className={`badge ${primarySignal.direction}`}>{primarySignal.direction}</span>
            </div>
          </div>

          <div className="metric-grid four" style={{ marginTop: 16 }}>
            <Metric label="Trigger" value={primarySignal.trigger} />
            <Metric label="Trend State" value={state.trendState} />
            <Metric label="Confidence" value={state.confidence} />
            <Metric label="Risk" value={primarySignal.risk} />
          </div>
        </div>
      ) : null}

      <div
        className="grid section"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
      >
        <ExecutionCard
          title="Long Execution"
          location={state.execution.longLocation}
          quality={state.execution.longQuality}
          riskState={state.execution.longRiskState}
          note={state.execution.longExecutionNote}
          tone={state.execution.longTone}
        />
        <ExecutionCard
          title="Short Execution"
          location={state.execution.shortLocation}
          quality={state.execution.shortQuality}
          riskState={state.execution.shortRiskState}
          note={state.execution.shortExecutionNote}
          tone={state.execution.shortTone}
        />
      </div>

      <div className="tabbar">
        <button
          className={`primary-btn ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          className={`primary-btn ${tab === 'signals' ? 'active' : ''}`}
          onClick={() => setTab('signals')}
        >
          Live Signals
        </button>
        <button
          className={`primary-btn ${tab === 'calendar' ? 'active' : ''}`}
          onClick={() => setTab('calendar')}
        >
          April News
        </button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="card section">
            <h2 style={{ marginTop: 0 }}>Chart</h2>
            <CandlestickChart
              candles={visibleCandles}
              supports={state.supports}
              resistances={state.resistances}
              longEntry={state.longEntry}
              shortEntry={state.shortEntry}
              longStop={state.longStop}
              shortStop={state.shortStop}
              longTargets={state.longTargets}
              shortTargets={state.shortTargets}
            />
          </div>

          <div
            className="grid section"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
          >
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Indicators</h2>
              <div className="metric-grid four">
                <Metric label="RSI" value={fmt(state.rsi, 1)} />
                <Metric label="EMA 21" value={`$${fmt(state.ema21, 0)}`} />
                <Metric label="EMA 50" value={`$${fmt(state.ema50, 0)}`} />
                <Metric label="EMA 200" value={`$${fmt(state.ema200, 0)}`} />
              </div>
              <div className="metric" style={{ marginTop: 12 }}>
                <div className="value">
                  MACD state: {state.macdState}. Volume profile is an approximation from candle
                  data, not true exchange-level orderflow.
                </div>
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Correlation Context</h2>
              <div className="metric-grid three">
                <Metric label="DXY" value={state.dxy} />
                <Metric label="SPY" value={state.spy} />
                <Metric label="ETH/BTC" value={state.ethbtc} />
              </div>
            </div>
          </div>

          <div
            className="grid section"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
          >
            <ScenarioCard
              title="Long Scenario"
              direction="bullish"
              entry={`${fmt(state.longEntry[0], 0)} - ${fmt(state.longEntry[1], 0)}`}
              stop={fmt(state.longStop, 0)}
              targets={state.longTargets.map((x) => fmt(x, 0))}
              rr={rrLong}
              invalidation={`4H close below ${fmt(state.longStop, 0)}`}
            />
            <ScenarioCard
              title="Short Scenario"
              direction="bearish"
              entry={`${fmt(state.shortEntry[0], 0)} - ${fmt(state.shortEntry[1], 0)}`}
              stop={fmt(state.shortStop, 0)}
              targets={state.shortTargets.map((x) => fmt(x, 0))}
              rr={rrShort}
              invalidation={`4H close above ${fmt(state.shortStop, 0)}`}
            />
          </div>
        </>
      )}

      {tab === 'signals' && (
        <div
          className="grid section"
          style={{ gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(340px, 1.05fr)' }}
        >
          <div className="card">
            <div className="space-between" style={{ alignItems: 'center' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>Pro Signal Board</h2>
              <div className="row" style={{ gap: 8 }}>
                <span className={`badge ${state.bias}`}>{state.bias}</span>
                <span className="badge">{state.trendState}</span>
              </div>
            </div>

            <div className="grid" style={{ marginTop: 14, gap: 12 }}>
              {state.signals.map((signal, index) => (
                <button
                  key={`${signal.title}-${index}`}
                  className="ghost-btn"
                  onClick={() => setActiveSignal(signal)}
                  style={{
                    textAlign: 'left',
                    border:
                      activeSignal?.title === signal.title
                        ? '1px solid rgba(122,162,255,.45)'
                        : undefined,
                  }}
                >
                  <div className="space-between" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{signal.title}</div>
                      <div className="muted" style={{ marginTop: 6 }}>{signal.trigger}</div>
                    </div>

                    <div
                      className="row"
                      style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}
                    >
                      <SignalTypeBadge type={signal.type} />
                      <StrengthBadge strength={signal.strength} />
                    </div>
                  </div>

                  <div
                    className="metric-grid three"
                    style={{ marginTop: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
                  >
                    <MiniMetric label="Direction" value={signal.direction} />
                    <MiniMetric label="Trend" value={state.trendState} />
                    <MiniMetric label="Confidence" value={state.confidence} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Execution Detail</h2>
            {activeSignal ? (
              <div className="grid" style={{ gap: 12 }}>
                <div className="space-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                    <Activity size={18} color="#7aa2ff" />
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{activeSignal.title}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        Type: {activeSignal.type} · Strength: {activeSignal.strength}
                      </div>
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <SignalTypeBadge type={activeSignal.type} />
                    <StrengthBadge strength={activeSignal.strength} />
                    <span className={`badge ${activeSignal.direction}`}>{activeSignal.direction}</span>
                  </div>
                </div>

                <div className="metric-grid two">
                  <Metric label="Trigger" value={activeSignal.trigger} />
                  <Metric label="Invalidation" value={activeSignal.invalidation} />
                  <Metric label="Execution note" value={activeSignal.note} />
                  <Metric label="Risk note" value={activeSignal.risk} />
                </div>

                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                  }}
                >
                  <TradeExecutionBox
                    title="Trend State"
                    value={state.trendState}
                    tone={
                      state.trendState === 'uptrend'
                        ? 'bullish'
                        : state.trendState === 'downtrend'
                        ? 'bearish'
                        : 'neutral'
                    }
                  />
                  <TradeExecutionBox title="Bias" value={state.bias} tone={state.bias} />
                  <TradeExecutionBox
                    title="RSI Regime"
                    value={state.rsi >= 55 ? 'Bullish' : state.rsi <= 45 ? 'Bearish' : 'Neutral'}
                    tone={state.rsi >= 55 ? 'bullish' : state.rsi <= 45 ? 'bearish' : 'neutral'}
                  />
                  <TradeExecutionBox
                    title="EMA State"
                    value={
                      state.ema21 > state.ema50 && state.ema50 > state.ema200
                        ? 'Bull stack'
                        : state.ema21 < state.ema50 && state.ema50 < state.ema200
                        ? 'Bear stack'
                        : 'Mixed'
                    }
                    tone={
                      state.ema21 > state.ema50 && state.ema50 > state.ema200
                        ? 'bullish'
                        : state.ema21 < state.ema50 && state.ema50 < state.ema200
                        ? 'bearish'
                        : 'neutral'
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="muted">Choose a signal to inspect.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="card section">
          <div className="row">
            <CalendarDays size={18} />
            <h2 style={{ margin: 0 }}>April News Calendar</h2>
          </div>

          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 12 }}
          >
            {[
              ['Apr 3', 'US Payrolls', 'High-impact macro release for rates and risk assets.'],
              ['Apr 10', 'US CPI', 'Inflation print with direct implications for DXY and crypto risk appetite.'],
              ['Apr 14', 'US PPI', 'Producer inflation release, useful secondary macro input.'],
              ['Apr 27–29', 'Bitcoin Conference', 'Event-driven sentiment and headline risk for BTC.'],
              ['Apr 28–29', 'FOMC Meeting', 'High-impact Fed window. Reduce leverage into the decision.'],
              ['Weekly', 'Jobless Claims / Treasury auctions', 'Use as secondary volatility checkpoints.'],
            ].map(([date, title, desc]) => (
              <div key={title} className="metric">
                <div className="label" style={{ color: 'var(--neutral)' }}>{date}</div>
                <div className="value">{title}</div>
                <div className="muted" style={{ marginTop: 8 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorText ? (
        <div className="alert section">
          <div className="row">
            <ShieldAlert size={18} /> <strong>Live fetch issue</strong>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            {errorText}. The dashboard stays usable with fallback data while the hosted API route
            is fixed.
          </div>
        </div>
      ) : null}

      <div className="card small">
        <div className="space-between">
          <div className="row">
            {mode.startsWith('live') ? (
              <Wifi size={16} color="#19c37d" />
            ) : (
              <WifiOff size={16} color="#9aa4b2" />
            )}
            <span>
              Status:{' '}
              {mode === 'fallback'
                ? 'Fallback snapshot'
                : mode === 'loading'
                ? 'Loading live...'
                : mode === 'live-binance'
                ? 'Live: Binance via hosted server route'
                : mode === 'live-coingecko'
                ? 'Live: CoinGecko via hosted server route'
                : 'Live fetch failed'}
            </span>
          </div>
          <span>Deployment target: Vercel or Netlify</span>
        </div>
      </div>
    </div>
  );
}

function CandlestickChart({
  candles,
  supports = [],
  resistances = [],
  longEntry,
  shortEntry,
  longStop,
  shortStop,
  longTargets = [],
  shortTargets = [],
}: {
  candles: Candle[];
  supports?: number[];
  resistances?: number[];
  longEntry?: [number, number];
  shortEntry?: [number, number];
  longStop?: number;
  shortStop?: number;
  longTargets?: number[];
  shortTargets?: number[];
}) {
  const width = 1000;
  const height = 420;
  const padLeft = 56;
  const padRight = 34;
  const padTop = 20;
  const padBottom = 28;

  if (!candles.length) {
    return (
      <div className="chart-box" style={{ display: 'grid', placeItems: 'center' }}>
        No chart data
      </div>
    );
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const levelValues = [
    ...highs,
    ...lows,
    ...supports,
    ...resistances,
    ...(longEntry ? [longEntry[0], longEntry[1]] : []),
    ...(shortEntry ? [shortEntry[0], shortEntry[1]] : []),
    ...(typeof longStop === 'number' ? [longStop] : []),
    ...(typeof shortStop === 'number' ? [shortStop] : []),
    ...longTargets,
    ...shortTargets,
  ].filter((n) => Number.isFinite(n));

  const max = Math.max(...levelValues);
  const min = Math.min(...levelValues);
  const range = Math.max(max - min, 1);

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const stepX = plotW / candles.length;
  const candleWidth = Math.max(4, stepX * 0.58);

  const y = (price: number) => padTop + ((max - price) / range) * plotH;
  const axisLevels = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);

  return (
    <div className="chart-box" style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {axisLevels.map((price, i) => {
          const yy = y(price);
          return (
            <g key={i}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={yy}
                y2={yy}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />
              <text x="8" y={yy + 4} fontSize="11" fill="#94a3b8">
                {price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {supports.map((price, i) => (
          <LevelLine
            key={`support-${i}-${price}`}
            y={y(price)}
            price={price}
            color="#19c37d"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="6 4"
          />
        ))}

        {resistances.map((price, i) => (
          <LevelLine
            key={`resistance-${i}-${price}`}
            y={y(price)}
            price={price}
            color="#ff5d5d"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="6 4"
          />
        ))}

        {longEntry ? (
          <LevelLine
            y={y(longEntry[0])}
            price={longEntry[0]}
            color="#22c55e"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="2 3"
          />
        ) : null}

        {shortEntry ? (
          <LevelLine
            y={y(shortEntry[0])}
            price={shortEntry[0]}
            color="#ef4444"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="2 3"
          />
        ) : null}

        {typeof longStop === 'number' ? (
          <LevelLine
            y={y(longStop)}
            price={longStop}
            color="#16a34a"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="10 4"
          />
        ) : null}

        {typeof shortStop === 'number' ? (
          <LevelLine
            y={y(shortStop)}
            price={shortStop}
            color="#dc2626"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="10 4"
          />
        ) : null}

        {longTargets.slice(0, 3).map((price, i) => (
          <LevelLine
            key={`lt-${i}-${price}`}
            y={y(price)}
            price={price}
            color="#86efac"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="3 6"
          />
        ))}

        {shortTargets.slice(0, 3).map((price, i) => (
          <LevelLine
            key={`st-${i}-${price}`}
            y={y(price)}
            price={price}
            color="#fca5a5"
            width={width}
            padLeft={padLeft}
            padRight={padRight}
            dash="3 6"
          />
        ))}

        {longEntry ? (
          <ChartLabel
            x={padLeft + 8}
            y={y(longEntry[0]) - 8}
            text={`Long Entry ${longEntry[0].toFixed(0)}`}
            color="#22c55e"
          />
        ) : null}

        {typeof longStop === 'number' ? (
          <ChartLabel
            x={padLeft + 8}
            y={y(longStop) - 8}
            text={`Long SL ${longStop.toFixed(0)}`}
            color="#16a34a"
          />
        ) : null}

        {longTargets.slice(0, 3).map((price, i) => (
          <ChartLabel
            key={`long-label-${i}-${price}`}
            x={padLeft + 8}
            y={y(price) - 8}
            text={`L TP${i + 1} ${price.toFixed(0)}`}
            color="#86efac"
          />
        ))}

        {shortEntry ? (
          <ChartLabel
            x={width - 220}
            y={y(shortEntry[0]) - 8}
            text={`Short Entry ${shortEntry[0].toFixed(0)}`}
            color="#ef4444"
          />
        ) : null}

        {typeof shortStop === 'number' ? (
          <ChartLabel
            x={width - 220}
            y={y(shortStop) - 8}
            text={`Short SL ${shortStop.toFixed(0)}`}
            color="#dc2626"
          />
        ) : null}

        {shortTargets.slice(0, 3).map((price, i) => (
          <ChartLabel
            key={`short-label-${i}-${price}`}
            x={width - 220}
            y={y(price) - 8}
            text={`S TP${i + 1} ${price.toFixed(0)}`}
            color="#fca5a5"
          />
        ))}

        {candles.map((candle, i) => {
          const x = padLeft + i * stepX + stepX / 2;
          const openY = y(candle.open);
          const closeY = y(candle.close);
          const highY = y(candle.high);
          const lowY = y(candle.low);

          const bullish = candle.close >= candle.open;
          const color = bullish ? '#19c37d' : '#ff5d5d';
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

          return (
            <g key={candle.time}>
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1.3" />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                rx="1.4"
                fill={color}
                opacity="0.95"
              />
            </g>
          );
        })}

        {candles
          .filter((_, i) => i % Math.max(1, Math.floor(candles.length / 6)) === 0)
          .map((candle) => {
            const i = candles.findIndex((x) => x.time === candle.time);
            const x = padLeft + i * stepX + stepX / 2;
            const label = new Date(candle.time).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });

            return (
              <text
                key={`label-${candle.time}`}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#94a3b8"
              >
                {label}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

function LevelLine({
  y,
  price,
  color,
  width,
  padLeft,
  padRight,
  dash,
}: {
  y: number;
  price: number;
  color: string;
  width: number;
  padLeft: number;
  padRight: number;
  dash: string;
}) {
  return (
    <g>
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={y}
        y2={y}
        stroke={color}
        strokeDasharray={dash}
        strokeWidth="1.15"
        opacity="0.85"
      />
      <text x={width - padRight - 4} y={y - 4} textAnchor="end" fontSize="11" fill={color}>
        {price.toFixed(0)}
      </text>
    </g>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(255,255,255,.03)',
        borderRadius: 14,
        padding: '10px 12px',
      }}
    >
      <div
        className="small"
        style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.12em' }}
      >
        {label}
      </div>
      <div style={{ marginTop: 6, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function TradeExecutionBox({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: 'bullish' | 'bearish' | 'neutral';
}) {
  const color =
    tone === 'bullish'
      ? 'rgba(25,195,125,.18)'
      : tone === 'bearish'
      ? 'rgba(255,93,93,.18)'
      : 'rgba(122,162,255,.14)';

  const border =
    tone === 'bullish'
      ? 'rgba(25,195,125,.28)'
      : tone === 'bearish'
      ? 'rgba(255,93,93,.28)'
      : 'rgba(122,162,255,.25)';

  return (
    <div
      style={{
        background: color,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div
        className="small"
        style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.12em' }}
      >
        {title}
      </div>
      <div style={{ marginTop: 8, fontWeight: 800, fontSize: 17 }}>{value}</div>
    </div>
  );
}

function ExecutionCard({
  title,
  location,
  quality,
  riskState,
  note,
  tone,
}: {
  title: string;
  location: ExecutionLocation;
  quality: number;
  riskState: string;
  note: string;
  tone: ExecutionTone;
}) {
  const bg =
    tone === 'good'
      ? 'rgba(25,195,125,.12)'
      : tone === 'neutral'
      ? 'rgba(122,162,255,.10)'
      : tone === 'warning'
      ? 'rgba(245,185,66,.12)'
      : 'rgba(255,93,93,.12)';

  const border =
    tone === 'good'
      ? 'rgba(25,195,125,.28)'
      : tone === 'neutral'
      ? 'rgba(122,162,255,.25)'
      : tone === 'warning'
      ? 'rgba(245,185,66,.28)'
      : 'rgba(255,93,93,.28)';

  return (
    <div
      className="card"
      style={{
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <div className="space-between" style={{ alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        <LocationBadge location={location} />
      </div>

      <div className="metric-grid two" style={{ marginTop: 14 }}>
        <Metric label="Setup Quality" value={`${quality}/100`} />
        <Metric label="Risk State" value={riskState} />
      </div>

      <div className="metric" style={{ marginTop: 12 }}>
        <div className="label">Execution note</div>
        <div className="value">{note}</div>
      </div>
    </div>
  );
}

function LocationBadge({ location }: { location: ExecutionLocation }) {
  const cls =
    location === 'active'
      ? 'bullish'
      : location === 'early'
      ? 'neutral'
      : location === 'late'
      ? 'warn'
      : 'bearish';

  return <span className={`badge ${cls}`}>{location}</span>;
}

function ChartLabel({
  x,
  y,
  text,
  color,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
}) {
  return (
    <text x={x} y={y} fontSize="11" fill={color} fontWeight="700">
      {text}
    </text>
  );
}

function StatusDelta({ change }: { change: number }) {
  const positive = change >= 0;

  return (
    <span className={`badge ${positive ? 'bullish' : 'bearish'}`}>
      {positive ? (
        <TrendingUp size={14} style={{ marginRight: 4 }} />
      ) : (
        <TrendingDown size={14} style={{ marginRight: 4 }} />
      )}
      {fmt(change, 2)}%
    </span>
  );
}

function StatusBadge({ mode }: { mode: LiveMode }) {
  if (mode === 'live-binance') return <span className="badge bullish">Live: Binance</span>;
  if (mode === 'live-coingecko') return <span className="badge neutral">Live: CoinGecko</span>;
  if (mode === 'loading') return <span className="badge warn">Loading live...</span>;
  if (mode === 'failed') return <span className="badge bearish">Live fetch failed</span>;
  return <span className="badge">Fallback snapshot</span>;
}

function SignalTypeBadge({ type }: { type: SignalCard['type'] }) {
  const map: Record<SignalCard['type'], { label: string; cls: string; icon: ReactNode }> = {
    'confirmed-long': {
      label: 'Confirmed',
      cls: 'bullish',
      icon: <Zap size={13} style={{ marginRight: 4 }} />,
    },
    'aggressive-long': {
      label: 'Aggressive',
      cls: 'bullish',
      icon: <TrendingUp size={13} style={{ marginRight: 4 }} />,
    },
    'confirmed-short': {
      label: 'Confirmed',
      cls: 'bearish',
      icon: <Zap size={13} style={{ marginRight: 4 }} />,
    },
    'aggressive-short': {
      label: 'Aggressive',
      cls: 'bearish',
      icon: <TrendingDown size={13} style={{ marginRight: 4 }} />,
    },
    'breakout-watch': {
      label: 'Breakout Watch',
      cls: 'neutral',
      icon: <Activity size={13} style={{ marginRight: 4 }} />,
    },
    'liquidity-sweep-watch': {
      label: 'Sweep Watch',
      cls: 'neutral',
      icon: <AlertTriangle size={13} style={{ marginRight: 4 }} />,
    },
    wait: {
      label: 'Wait',
      cls: 'warn',
      icon: <AlertTriangle size={13} style={{ marginRight: 4 }} />,
    },
  };

  const item = map[type];

  return (
    <span className={`badge ${item.cls}`}>
      {item.icon}
      {item.label}
    </span>
  );
}

function StrengthBadge({ strength }: { strength: SignalCard['strength'] }) {
  const cls = strength === 'high' ? 'bullish' : strength === 'medium' ? 'neutral' : 'warn';
  return <span className={`badge ${cls}`}>Strength: {strength}</span>;
}

function ScenarioCard({
  title,
  direction,
  entry,
  stop,
  targets,
  rr,
  invalidation,
}: {
  title: string;
  direction: 'bullish' | 'bearish';
  entry: string;
  stop: string;
  targets: string[];
  rr: number;
  invalidation: string;
}) {
  return (
    <div className="card">
      <div className="space-between">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className={`badge ${direction}`}>{direction}</span>
      </div>

      <div className="metric-grid two" style={{ marginTop: 16 }}>
        <Metric label="Entry" value={entry} />
        <Metric label="Stop" value={stop} />
        <Metric label="Targets" value={targets.join(' / ')} />
        <Metric label="R:R" value={Number.isFinite(rr) ? rr.toFixed(2) : '—'} />
      </div>

      <div className="metric" style={{ marginTop: 12 }}>
        <div className="value">Invalidation: {invalidation}</div>
      </div>
    </div>
  );
}