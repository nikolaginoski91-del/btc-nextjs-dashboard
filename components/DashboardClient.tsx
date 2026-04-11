"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardClientPhase60Base from "@/components/DashboardClient_backup";

type Tone = "green" | "red" | "yellow" | "blue" | "neutral";

type RegimeResponse = {
  ok: boolean;
  source?: string;
  isLive?: boolean;
  updatedAt?: string;
  input?: {
    price: number;
    ema20: number;
    ema50: number;
    ema200: number;
    rsi: number;
    atrPercent: number;
    volumeRatio: number;
    trendStrength: number;
  };
  result?: {
    regime: "TRENDING_BULL" | "TRENDING_BEAR" | "RANGE" | "TRANSITION" | "BREAKOUT_WATCH";
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
  };
  tradeGate?: {
    status: "TRADE ALLOWED" | "WAIT FOR CONFIRMATION" | "TRADE FILTERED";
    score: number;
    reason: string;
    notes: string[];
  };
};

function toneColors(tone: Tone) {
  switch (tone) {
    case "green":
      return {
        bg: "rgba(16,185,129,0.14)",
        border: "rgba(16,185,129,0.28)",
        text: "#86efac",
      };
    case "red":
      return {
        bg: "rgba(239,68,68,0.14)",
        border: "rgba(239,68,68,0.28)",
        text: "#fca5a5",
      };
    case "yellow":
      return {
        bg: "rgba(245,158,11,0.14)",
        border: "rgba(245,158,11,0.28)",
        text: "#fcd34d",
      };
    case "blue":
      return {
        bg: "rgba(59,130,246,0.14)",
        border: "rgba(59,130,246,0.28)",
        text: "#93c5fd",
      };
    default:
      return {
        bg: "rgba(255,255,255,0.06)",
        border: "rgba(255,255,255,0.10)",
        text: "rgba(255,255,255,0.88)",
      };
  }
}

function cardStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 22,
    padding: 18,
    ...extra,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 10,
  };
}

function smallMetaStyle(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  };
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  const colors = toneColors(tone);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        padding: "7px 12px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
}) {
  const colors = toneColors(tone);

  return (
    <div style={cardStyle()}>
      <p style={labelStyle()}>{label}</p>
      <div style={{ fontSize: 26, fontWeight: 700, color: colors.text }}>{value}</div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  let fill = "#f87171";
  if (safe >= 70) fill = "#34d399";
  else if (safe >= 45) fill = "#fbbf24";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 14,
          color: "rgba(255,255,255,0.82)",
        }}
      >
        <span>{label}</span>
        <span>{safe}/100</span>
      </div>

      <div
        style={{
          height: 10,
          width: "100%",
          overflow: "hidden",
          borderRadius: 999,
          background: "rgba(255,255,255,0.10)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${safe}%`,
            borderRadius: 999,
            background: fill,
            transition: "width 400ms ease",
          }}
        />
      </div>
    </div>
  );
}

function InputCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.20)",
        borderRadius: 16,
        padding: 14,
        color: "rgba(255,255,255,0.88)",
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}

function ListPanel({
  title,
  badge,
  tone,
  items,
}: {
  title: string;
  badge: string;
  tone: Tone;
  items: string[];
}) {
  const colors = toneColors(tone);

  return (
    <div
      style={cardStyle({
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      })}
    >
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>{title}</h3>
        <Badge tone={tone}>{badge}</Badge>
      </div>

      <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 1.6 }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function sourceTone(source?: string, isLive?: boolean): Tone {
  if (!source || source === "fallback_mock" || !isLive) return "yellow";
  if (source === "live_context") return "green";
  if (source === "live_btc") return "blue";
  return "neutral";
}



function deriveTradeGate(result?: RegimeResponse["result"]) {
  if (!result) {
    return {
      status: "WAIT FOR CONFIRMATION" as const,
      score: 50,
      reason: "No regime result available yet.",
      notes: [],
    };
  }

  let score = 50;
  const notes: string[] = [];

  if (result.confidence >= 80) score += 14;
  else if (result.confidence >= 65) score += 8;
  else score -= 6;

  if (result.tradeCondition === "FAVORABLE") {
    score += 14;
    notes.push("Trade condition is favorable.");
  } else if (result.tradeCondition === "CAUTION") {
    score -= 4;
    notes.push("More confirmation is needed.");
  } else {
    score -= 18;
    notes.push("Trade condition is defensive.");
  }

  if (result.regime === "RANGE") {
    score -= 12;
    notes.push("Range market reduces trend edge.");
  }

  if (result.regime === "TRANSITION") {
    score -= 10;
    notes.push("Transition market increases fakeout risk.");
  }

  if (result.regime === "BREAKOUT_WATCH") {
    score -= 6;
    notes.push("Breakout confirmation is still missing.");
  }

  if (result.directionBias === "NEUTRAL") {
    score -= 8;
    notes.push("Directional bias is neutral.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let status: "TRADE ALLOWED" | "WAIT FOR CONFIRMATION" | "TRADE FILTERED" = "WAIT FOR CONFIRMATION";
  let reason = "Conditions are mixed. Wait for cleaner confirmation.";

  if (score >= 74) {
    status = "TRADE ALLOWED";
    reason = "Environment is good enough to trade if entry confirms.";
  } else if (score <= 44) {
    status = "TRADE FILTERED";
    reason = "Market conditions should be filtered out for now.";
  }

  return { status, score, reason, notes };
}

function sourceLabel(source?: string, isLive?: boolean) {
  if (!source || source === "fallback_mock" || !isLive) return "FALLBACK DATA";
  if (source === "live_context") return "LIVE: CONTEXT";
  if (source === "live_btc") return "LIVE: BTC ROUTE";
  return source.toUpperCase();
}

function RegimePanel() {
  const [data, setData] = useState<RegimeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRegime() {
    try {
      setLoading(true);
      const res = await fetch("/api/regime", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to load regime:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRegime();
  }, []);

  const result = data?.result;
  const input = data?.input;

  const regimeTone: Tone =
    result?.regime === "TRENDING_BULL"
      ? "green"
      : result?.regime === "TRENDING_BEAR"
      ? "red"
      : result?.regime === "BREAKOUT_WATCH"
      ? "blue"
      : result?.regime === "RANGE"
      ? "yellow"
      : "neutral";

  const biasTone: Tone =
    result?.directionBias === "BULLISH"
      ? "green"
      : result?.directionBias === "BEARISH"
      ? "red"
      : "neutral";

  const conditionTone: Tone =
    result?.tradeCondition === "FAVORABLE"
      ? "green"
      : result?.tradeCondition === "DEFENSIVE"
      ? "red"
      : "yellow";

  const liveTone = sourceTone(data?.source, data?.isLive);
  const tradeGate = data?.tradeGate ?? deriveTradeGate(result);

  const topGridStyle = useMemo<React.CSSProperties>(
    () => ({
      display: "grid",
      gap: 16,
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    }),
    []
  );

  return (
    <section
      style={{
        width: "100%",
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          "linear-gradient(135deg, rgba(11,18,32,0.98) 0%, rgba(11,16,32,0.98) 48%, rgba(5,7,13,0.98) 100%)",
        padding: 22,
        boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
        color: "#fff",
      }}
    >
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: "rgba(103,232,249,0.70)",
            }}
          >
            Phase 6.2
          </p>
          <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: "#fff" }}>
            Regime-Aware Market Filter
          </h2>
          <p style={{ margin: "10px 0 0 0", fontSize: 15, color: "rgba(255,255,255,0.64)" }}>
            Regime is now connected to execution filtering, trade readiness, and preferred side quality.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone={liveTone}>{sourceLabel(data?.source, data?.isLive)}</Badge>
          <button
            onClick={loadRegime}
            style={{
              borderRadius: 18,
              border: "1px solid rgba(34,211,238,0.20)",
              background: "rgba(34,211,238,0.10)",
              color: "#bae6fd",
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh Regime
          </button>
        </div>
      </div>

      {loading ? (
        <div style={cardStyle({ color: "rgba(255,255,255,0.70)", fontSize: 14 })}>Loading regime engine...</div>
      ) : !result ? (
        <div
          style={cardStyle({
            color: "#fecaca",
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.20)",
            fontSize: 14,
          })}
        >
          Failed to load regime engine.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ ...cardStyle({ background: "rgba(255,255,255,0.03)" }), paddingTop: 14, paddingBottom: 14 }}>
            <p style={smallMetaStyle()}>
              Source: <strong style={{ color: "#fff" }}>{data?.source ?? "unknown"}</strong>
              {" · "}
              Updated: <strong style={{ color: "#fff" }}>{data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}</strong>
            </p>
          </div>

          <div style={topGridStyle}>
            <div style={cardStyle()}>
              <p style={labelStyle()}>Market Regime</p>
              <Badge tone={regimeTone}>{result.regime}</Badge>
            </div>

            <div style={cardStyle()}>
              <p style={labelStyle()}>Direction Bias</p>
              <Badge tone={biasTone}>{result.directionBias}</Badge>
            </div>

            <div style={cardStyle()}>
              <p style={labelStyle()}>Trade Condition</p>
              <Badge tone={conditionTone}>{result.tradeCondition}</Badge>
            </div>

            <MetricCard label="Confidence" value={`${result.confidence}%`} tone={conditionTone} />
          </div>

          <div
            style={cardStyle({
              background: "rgba(34,211,238,0.06)",
              border: "1px solid rgba(34,211,238,0.12)",
            })}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "rgba(103,232,249,0.66)",
              }}
            >
              Operator Summary
            </p>
            <p style={{ margin: "12px 0 0 0", fontSize: 22, fontWeight: 700, color: "#fff" }}>{result.summary}</p>
            <p style={{ margin: "10px 0 0 0", fontSize: 14, color: "rgba(255,255,255,0.72)" }}>
              {result.operatorNote}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            <div style={cardStyle()}>
              <div
                style={{
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>Environment Scores</h3>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>Regime-aware filter</span>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <ScoreBar label="Bull Score" value={result.bullScore} />
                <ScoreBar label="Bear Score" value={result.bearScore} />
                <ScoreBar label="Range Score" value={result.rangeScore} />
                <ScoreBar label="Breakout Score" value={result.breakoutScore} />
              </div>
            </div>

            <div style={cardStyle()}>
              <div
                style={{
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>Input Snapshot</h3>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>
                  {data?.isLive ? "Regime input values" : "Fallback values"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                }}
              >
                <InputCell>Price: {input?.price ?? "-"}</InputCell>
                <InputCell>RSI: {input?.rsi ?? "-"}</InputCell>
                <InputCell>EMA20: {input?.ema20 ?? "-"}</InputCell>
                <InputCell>EMA50: {input?.ema50 ?? "-"}</InputCell>
                <InputCell>EMA200: {input?.ema200 ?? "-"}</InputCell>
                <InputCell>ATR %: {input?.atrPercent ?? "-"}</InputCell>
                <InputCell>Volume Ratio: {input?.volumeRatio ?? "-"}</InputCell>
                <InputCell>Trend Strength: {input?.trendStrength ?? "-"}</InputCell>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div style={cardStyle()}>
              <p style={labelStyle()}>Trade Gate</p>
              <Badge tone={tradeGate.status === "TRADE ALLOWED" ? "green" : tradeGate.status === "TRADE FILTERED" ? "red" : "yellow"}>
                {tradeGate.status}
              </Badge>
              <p style={{ margin: "14px 0 6px 0", fontSize: 14, color: "rgba(255,255,255,0.82)" }}>
                {tradeGate.reason}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.62)" }}>
                Score: {tradeGate.score}
              </p>
            </div>

            <ListPanel
              title="What Confirms This Regime"
              badge="CONFIRMS"
              tone="green"
              items={result.confirms}
            />

            <ListPanel
              title="What Invalidates This Regime"
              badge="INVALIDATES"
              tone="red"
              items={result.invalidates}
            />
          </div>
        </div>
      )}
    </section>
  );
}


function PositionSizingPanel({ data }: { data: RegimeResponse | null }) {
  const [accountSize, setAccountSize] = useState(1000);
  const [riskPreset, setRiskPreset] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [riskPercent, setRiskPercent] = useState(0.5);
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [stopPrice, setStopPrice] = useState<number>(0);

  useEffect(() => {
    if (!data?.input?.price) return;
    const price = Number(data.input.price);
    setEntryPrice(Math.round(price));
    const fallbackStop =
      data.result?.directionBias === "BEARISH"
        ? Math.round(price * 1.01)
        : Math.round(price * 0.99);
    setStopPrice(fallbackStop);
  }, [data?.input?.price, data?.result?.directionBias]);

  const tradeGate = data?.tradeGate ?? deriveTradeGate(data?.result);

  const presetBase =
    riskPreset === "conservative" ? 0.35 : riskPreset === "aggressive" ? 1.0 : 0.5;

  const recommendedRisk =
    tradeGate.status === "TRADE FILTERED"
      ? 0
      : tradeGate.status === "WAIT FOR CONFIRMATION"
      ? Math.min(presetBase, 0.35)
      : presetBase;

  useEffect(() => {
    setRiskPercent(recommendedRisk);
  }, [recommendedRisk]);

  const riskAmount = accountSize * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopPrice);
  const sizeBtc = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const positionUsd = sizeBtc * entryPrice;

  let riskMode = "Normal";
  if (tradeGate.status === "TRADE FILTERED") riskMode = "Stand down";
  else if (data?.tradeGate?.status === "WAIT FOR CONFIRMATION") riskMode = "Reduced";
  else if (data?.result?.tradeCondition === "FAVORABLE") riskMode = "Allowed";

  return (
    <section
      style={{
        width: "100%",
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          "linear-gradient(135deg, rgba(11,18,32,0.98) 0%, rgba(11,16,32,0.98) 48%, rgba(5,7,13,0.98) 100%)",
        padding: 22,
        boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
        color: "#fff",
      }}
    >
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: "rgba(103,232,249,0.70)",
            }}
          >
            Phase 6.6
          </p>
          <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: "#fff" }}>
            Execution Plan + Risk Presets
          </h2>
          <p style={{ margin: "10px 0 0 0", fontSize: 15, color: "rgba(255,255,255,0.64)" }}>
            Sizing now includes a simple execution plan for scale-out and stop management.
          </p>
        </div>

        <Badge tone={riskMode === "Stand down" ? "red" : riskMode === "Reduced" ? "yellow" : "green"}>
          {riskMode}
        </Badge>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 18,
        }}
      >
        <div style={cardStyle()}>
          <p style={labelStyle()}>Risk Preset</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["conservative", "balanced", "aggressive"] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setRiskPreset(preset)}
                style={{
                  borderRadius: 12,
                  border: riskPreset === preset ? "1px solid rgba(34,211,238,0.35)" : "1px solid rgba(255,255,255,0.10)",
                  background: riskPreset === preset ? "rgba(34,211,238,0.10)" : "rgba(0,0,0,0.20)",
                  color: "#fff",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {preset.toUpperCase()}
              </button>
            ))}
          </div>
          <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "rgba(255,255,255,0.60)" }}>
            Recommended risk: {recommendedRisk.toFixed(2)}%
          </p>
        </div>

        <div style={cardStyle()}>
          <p style={labelStyle()}>Account Size ($)</p>
          <input
            type="number"
            value={accountSize}
            onChange={(e) => setAccountSize(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
        <div style={cardStyle()}>
          <p style={labelStyle()}>Risk %</p>
          <input
            type="number"
            step="0.1"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
        <div style={cardStyle()}>
          <p style={labelStyle()}>Entry Price</p>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
        <div style={cardStyle()}>
          <p style={labelStyle()}>Stop Price</p>
          <input
            type="number"
            value={stopPrice}
            onChange={(e) => setStopPrice(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <MetricCard label="Risk Amount" value={`$${riskAmount.toFixed(2)}`} tone="yellow" />
        <MetricCard label="Stop Distance" value={`$${stopDistance.toFixed(2)}`} tone="neutral" />
        <MetricCard label="Position Size (BTC)" value={sizeBtc ? sizeBtc.toFixed(4) : "0.0000"} tone="blue" />
        <MetricCard label="Position Size ($)" value={`$${positionUsd.toFixed(2)}`} tone="green" />
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 18,
        }}
      >
        <MetricCard label="Trade Gate Score" value={String(tradeGate.score)} tone={tradeGate.status === "TRADE ALLOWED" ? "green" : tradeGate.status === "TRADE FILTERED" ? "red" : "yellow"} />
        <MetricCard label="Risk Mode" value={riskMode} tone={riskMode === "Allowed" || riskMode === "Normal" ? "green" : riskMode === "Reduced" ? "yellow" : "red"} />
        <MetricCard label="Preset" value={riskPreset.toUpperCase()} tone="neutral" />
        <MetricCard label="Recommended Risk %" value={`${recommendedRisk.toFixed(2)}%`} tone="blue" />
      </div>

      <div style={{ ...cardStyle({ marginTop: 18, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.12)" }) }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "rgba(103,232,249,0.66)",
          }}
        >
          Sizing Guidance
        </p>
        <p style={{ margin: "12px 0 0 0", fontSize: 18, fontWeight: 700, color: "#fff" }}>
          {tradeGate.status === "TRADE FILTERED"
            ? "Trade is filtered. Size should stay at zero."
            : data?.tradeGate?.status === "WAIT FOR CONFIRMATION"
            ? "Setup is not fully ready. Consider smaller size or wait."
            : "Conditions are good enough to size normally if entry confirms."}
        </p>
      </div>
    </section>
  );
}




function ExecutionPlanPanel({ data }: { data: RegimeResponse | null }) {
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [stopPrice, setStopPrice] = useState<number>(0);
  const [tp1, setTp1] = useState<number>(0);
  const [tp2, setTp2] = useState<number>(0);
  const [tp3, setTp3] = useState<number>(0);

  useEffect(() => {
    if (!data?.input?.price) return;
    const price = Number(data.input.price);
    const bullish = data?.result?.directionBias !== "BEARISH";
    const defaultStop = bullish ? price * 0.99 : price * 1.01;
    const defaultTp1 = bullish ? price * 1.01 : price * 0.99;
    const defaultTp2 = bullish ? price * 1.02 : price * 0.98;
    const defaultTp3 = bullish ? price * 1.03 : price * 0.97;

    setEntryPrice(Math.round(price));
    setStopPrice(Math.round(defaultStop));
    setTp1(Math.round(defaultTp1));
    setTp2(Math.round(defaultTp2));
    setTp3(Math.round(defaultTp3));
  }, [data?.input?.price, data?.result?.directionBias]);

  const risk = Math.abs(entryPrice - stopPrice);
  const reward1 = Math.abs(tp1 - entryPrice);
  const reward2 = Math.abs(tp2 - entryPrice);
  const reward3 = Math.abs(tp3 - entryPrice);

  const rr1 = risk > 0 ? reward1 / risk : 0;
  const rr2 = risk > 0 ? reward2 / risk : 0;
  const rr3 = risk > 0 ? reward3 / risk : 0;

  const stopPlan =
    rr1 >= 1
      ? "After TP1, move stop to breakeven."
      : "Keep original stop until structure confirms.";

  const scalingPlan =
    rr2 >= 2
      ? "Suggested scale-out: 40% at TP1, 35% at TP2, 25% runner."
      : "Suggested scale-out: 50% at TP1, 30% at TP2, 20% runner.";

  return (
    <section
      style={{
        width: "100%",
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          "linear-gradient(135deg, rgba(11,18,32,0.98) 0%, rgba(11,16,32,0.98) 48%, rgba(5,7,13,0.98) 100%)",
        padding: 22,
        boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
        color: "#fff",
      }}
    >
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: "rgba(103,232,249,0.70)",
            }}
          >
            Phase 6.6
          </p>
          <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: "#fff" }}>
            Execution Plan Engine
          </h2>
          <p style={{ margin: "10px 0 0 0", fontSize: 15, color: "rgba(255,255,255,0.64)" }}>
            Turns your entry, stop, and targets into a simple plan you can actually execute.
          </p>
        </div>

        <Badge tone="blue">PLAN BUILDER</Badge>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 18,
        }}
      >
        <div style={cardStyle()}>
          <p style={labelStyle()}>Entry</p>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
        <div style={cardStyle()}>
          <p style={labelStyle()}>Stop</p>
          <input
            type="number"
            value={stopPrice}
            onChange={(e) => setStopPrice(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
        <div style={cardStyle()}>
          <p style={labelStyle()}>TP1</p>
          <input
            type="number"
            value={tp1}
            onChange={(e) => setTp1(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
        <div style={cardStyle()}>
          <p style={labelStyle()}>TP2</p>
          <input
            type="number"
            value={tp2}
            onChange={(e) => setTp2(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
        <div style={cardStyle()}>
          <p style={labelStyle()}>TP3</p>
          <input
            type="number"
            value={tp3}
            onChange={(e) => setTp3(Number(e.target.value || 0))}
            style={{ width: "100%", borderRadius: 12, padding: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <MetricCard label="R:R to TP1" value={rr1 ? rr1.toFixed(2) : "0.00"} tone={rr1 >= 1 ? "green" : "yellow"} />
        <MetricCard label="R:R to TP2" value={rr2 ? rr2.toFixed(2) : "0.00"} tone={rr2 >= 2 ? "green" : "yellow"} />
        <MetricCard label="R:R to TP3" value={rr3 ? rr3.toFixed(2) : "0.00"} tone={rr3 >= 3 ? "green" : "blue"} />
        <MetricCard label="Risk Distance" value={`$${risk.toFixed(2)}`} tone="red" />
      </div>

      <div style={{ ...cardStyle({ marginTop: 18, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.12)" }) }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "rgba(103,232,249,0.66)",
          }}
        >
          Management Plan
        </p>
        <p style={{ margin: "12px 0 0 0", fontSize: 18, fontWeight: 700, color: "#fff" }}>
          {scalingPlan}
        </p>
        <p style={{ margin: "10px 0 0 0", fontSize: 14, color: "rgba(255,255,255,0.72)" }}>
          {stopPlan}
        </p>
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------ */
/* Phase 6.8 — Hero Decision Section                                   */
/* Additive. Renders at the very top of the dashboard.                 */
/* Uses RegimeResponse already fetched by the main component.          */
/* ------------------------------------------------------------------ */

function HeroDecisionPanel({ data }: { data: RegimeResponse | null }) {
  const tradeGate = data?.tradeGate ?? deriveTradeGate(data?.result);
  const bias = data?.result?.directionBias;
  const price = data?.input?.price ?? 0;
  const confidence = data?.result?.confidence ?? 0;
  const regime = data?.result?.regime ?? "—";
  const condition = data?.result?.tradeCondition ?? "—";
  const summary = data?.result?.summary ?? "Loading market data…";
  const operatorNote = data?.result?.operatorNote ?? "";

  // ── Core decision logic ────────────────────────────────────────────
  type Decision = {
    label: string;
    sublabel: string;
    icon: string;
    color: string;
    glow: string;
    bg: string;
    border: string;
    badgeTone: Tone;
  };

  let decision: Decision;

  if (!data) {
    decision = {
      label: "LOADING",
      sublabel: "Fetching live regime data…",
      icon: "◷",
      color: "rgba(255,255,255,0.45)",
      glow: "none",
      bg: "rgba(255,255,255,0.04)",
      border: "rgba(255,255,255,0.10)",
      badgeTone: "neutral",
    };
  } else if (tradeGate.status === "TRADE FILTERED") {
    decision = {
      label: "DO NOT TRADE",
      sublabel: "Market conditions are filtered. Stand down.",
      icon: "✕",
      color: "#f87171",
      glow: "0 0 48px rgba(239,68,68,0.22)",
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.22)",
      badgeTone: "red",
    };
  } else if (tradeGate.status === "WAIT FOR CONFIRMATION") {
    decision = {
      label: "WAIT",
      sublabel: "Setup is forming. No clean trigger yet.",
      icon: "◷",
      color: "#fcd34d",
      glow: "0 0 48px rgba(245,158,11,0.20)",
      bg: "rgba(245,158,11,0.07)",
      border: "rgba(245,158,11,0.22)",
      badgeTone: "yellow",
    };
  } else if (bias === "BULLISH") {
    decision = {
      label: "LONG READY",
      sublabel: "Bias and gate align. Wait for trigger confirmation.",
      icon: "↑",
      color: "#34d399",
      glow: "0 0 56px rgba(16,185,129,0.24)",
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.24)",
      badgeTone: "green",
    };
  } else if (bias === "BEARISH") {
    decision = {
      label: "SHORT READY",
      sublabel: "Bias and gate align. Wait for rejection confirmation.",
      icon: "↓",
      color: "#f87171",
      glow: "0 0 56px rgba(239,68,68,0.24)",
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.24)",
      badgeTone: "red",
    };
  } else {
    decision = {
      label: "SELECTIVE",
      sublabel: "Bias is neutral. Only the cleanest setups qualify.",
      icon: "→",
      color: "#93c5fd",
      glow: "0 0 40px rgba(59,130,246,0.20)",
      bg: "rgba(59,130,246,0.07)",
      border: "rgba(59,130,246,0.22)",
      badgeTone: "blue",
    };
  }

  const score = tradeGate.score;
  const scoreFill =
    score >= 70 ? "#34d399" : score >= 45 ? "#fbbf24" : "#f87171";

  const regimeTone: Tone =
    regime === "TRENDING_BULL"
      ? "green"
      : regime === "TRENDING_BEAR"
      ? "red"
      : regime === "BREAKOUT_WATCH"
      ? "blue"
      : regime === "RANGE"
      ? "yellow"
      : "neutral";

  const conditionTone: Tone =
    condition === "FAVORABLE" ? "green" : condition === "DEFENSIVE" ? "red" : "yellow";

  const biasTone: Tone =
    bias === "BULLISH" ? "green" : bias === "BEARISH" ? "red" : "neutral";

  // Rough key levels from live price (visual reference only)
  const longZoneLow = price > 0 ? Math.round(price * 0.9935) : 0;
  const longZoneHigh = price > 0 ? Math.round(price * 0.997) : 0;
  const shortZoneLow = price > 0 ? Math.round(price * 1.003) : 0;
  const shortZoneHigh = price > 0 ? Math.round(price * 1.007) : 0;
  const longStop = price > 0 ? Math.round(price * 0.988) : 0;
  const shortStop = price > 0 ? Math.round(price * 1.011) : 0;

  function fmtPrice(n: number) {
    return n > 0 ? `$${n.toLocaleString()}` : "—";
  }

  return (
    <section
      style={{
        width: "100%",
        borderRadius: 28,
        border: `1px solid ${decision.border}`,
        background: `linear-gradient(135deg, ${decision.bg} 0%, rgba(5,7,13,0.98) 60%)`,
        padding: "28px 24px",
        boxShadow: decision.glow,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle background glow blob */}
      <div
        style={{
          position: "absolute",
          top: -60,
          left: -40,
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: decision.color,
          opacity: 0.04,
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      {/* Phase label */}
      <p
        style={{
          margin: "0 0 20px 0",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: "rgba(103,232,249,0.65)",
        }}
      >
        Phase 6.8 · Operator Decision
      </p>

      {/* Main layout: decision left, metrics right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* LEFT: Decision */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {/* Icon bubble */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: decision.bg,
                border: `2px solid ${decision.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: decision.color,
                flexShrink: 0,
              }}
            >
              {decision.icon}
            </div>

            {/* Decision text */}
            <div>
              <div
                style={{
                  fontSize: 46,
                  fontWeight: 900,
                  color: decision.color,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {decision.label}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.65)",
                  fontWeight: 500,
                }}
              >
                {decision.sublabel}
              </div>
            </div>
          </div>

          {/* Summary from regime engine */}
          <div
            style={{
              marginTop: 14,
              padding: "12px 16px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 14,
              color: "rgba(255,255,255,0.80)",
              lineHeight: 1.6,
              maxWidth: 680,
            }}
          >
            <strong style={{ color: "#fff" }}>{summary}</strong>
            {operatorNote && (
              <span style={{ color: "rgba(255,255,255,0.58)" }}>
                {" "}— {operatorNote}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Score ring */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            minWidth: 90,
          }}
        >
          {/* Score circle */}
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: `conic-gradient(${scoreFill} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#05070d",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800, color: scoreFill, lineHeight: 1 }}>
                {score}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.05em" }}>
                /100
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            Gate Score
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.07)",
          margin: "20px 0",
        }}
      />

      {/* Bottom row: 4 metric badges + key levels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {/* Gate status */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Trade Gate</p>
          <Badge
            tone={
              tradeGate.status === "TRADE ALLOWED"
                ? "green"
                : tradeGate.status === "TRADE FILTERED"
                ? "red"
                : "yellow"
            }
          >
            {tradeGate.status}
          </Badge>
        </div>

        {/* Regime */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Regime</p>
          <Badge tone={regimeTone}>{regime}</Badge>
        </div>

        {/* Bias */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Direction Bias</p>
          <Badge tone={biasTone}>{bias ?? "—"}</Badge>
        </div>

        {/* Condition */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Trade Condition</p>
          <Badge tone={conditionTone}>{condition}</Badge>
        </div>

        {/* Confidence */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Confidence</p>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{confidence}%</div>
        </div>

        {/* Long zone */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Long Watch Zone</p>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>
            {fmtPrice(longZoneLow)} – {fmtPrice(longZoneHigh)}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            Stop below {fmtPrice(longStop)}
          </div>
        </div>

        {/* Short zone */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Short Watch Zone</p>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>
            {fmtPrice(shortZoneLow)} – {fmtPrice(shortZoneHigh)}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            Stop above {fmtPrice(shortStop)}
          </div>
        </div>

        {/* Gate reason */}
        <div style={cardStyle()}>
          <p style={labelStyle()}>Gate Reason</p>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
            {tradeGate.reason}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 6.7 — Trade Journal + Outcome Tracker                         */
/* Additive. localStorage only. No backend.                            */
/* Types are declared locally here to keep this panel self-contained   */
/* and to avoid any import-path risk with @/lib/market.                */
/* ------------------------------------------------------------------ */

type JournalResult = "win" | "loss" | "break-even" | "skipped";
type JournalSide = "long" | "short";
type JournalSetupType =
  | "trend-continuation"
  | "breakout"
  | "pullback"
  | "reversal"
  | "range"
  | "liquidity-sweep";
type JournalMistakeTag =
  | "none"
  | "late-entry"
  | "early-entry"
  | "moved-stop"
  | "ignored-gate"
  | "oversized"
  | "revenge-trade"
  | "no-confirmation"
  | "poor-tp";

type TradeJournalEntry = {
  id: string;
  createdAt: string; // ISO UTC
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

const JOURNAL_STORAGE_KEY = "btc_dashboard_trade_journal_v1";

function formatJournalDateUTC(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm} UTC`;
  } catch {
    return "—";
  }
}

function makeJournalId(): string {
  return `tj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function journalInputStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    color: "#fff",
    fontSize: 14,
  };
}

const SETUP_OPTIONS: JournalSetupType[] = [
  "trend-continuation",
  "breakout",
  "pullback",
  "reversal",
  "range",
  "liquidity-sweep",
];

const MISTAKE_OPTIONS: JournalMistakeTag[] = [
  "none",
  "late-entry",
  "early-entry",
  "moved-stop",
  "ignored-gate",
  "oversized",
  "revenge-trade",
  "no-confirmation",
  "poor-tp",
];

const RESULT_OPTIONS: JournalResult[] = ["win", "loss", "break-even", "skipped"];

function TradeJournalPanel({ data }: { data: RegimeResponse | null }) {
  // IMPORTANT: start with empty list. Load from localStorage only inside
  // useEffect on the client, so there's no hydration mismatch.
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // form state
  const [side, setSide] = useState<JournalSide>("long");
  const [entry, setEntry] = useState<string>("");
  const [stop, setStop] = useState<string>("");
  const [tp, setTp] = useState<string>("");
  const [result, setResult] = useState<JournalResult>("win");
  const [setupType, setSetupType] = useState<JournalSetupType>("trend-continuation");
  const [notes, setNotes] = useState<string>("");
  const [mistakeTag, setMistakeTag] = useState<JournalMistakeTag>("none");
  const [riskPresetUsed, setRiskPresetUsed] = useState<string>("balanced");

  // Load from localStorage after mount.
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(JOURNAL_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setEntries(parsed as TradeJournalEntry[]);
        }
      }
    } catch {
      // corrupted storage — ignore safely
    }
    setHydrated(true);
  }, []);

  // Persist whenever entries change (after first hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
      }
    } catch {
      // quota / privacy mode — ignore safely
    }
  }, [entries, hydrated]);

  // Prefill defaults from live regime data where possible.
  const regimeAtEntry = data?.result?.regime ?? "UNKNOWN";
  const tradeGateAtEntry = (data?.tradeGate?.status ?? deriveTradeGate(data?.result).status) as string;

  useEffect(() => {
    if (!data?.input?.price) return;
    if (entry === "") {
      const price = Number(data.input.price);
      if (Number.isFinite(price)) {
        setEntry(String(Math.round(price)));
      }
    }
  }, [data?.input?.price, entry]);

  function resetForm() {
    setSide("long");
    setEntry("");
    setStop("");
    setTp("");
    setResult("win");
    setSetupType("trend-continuation");
    setNotes("");
    setMistakeTag("none");
    setRiskPresetUsed("balanced");
  }

  function parseNumOrNull(v: string): number | null {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function logTrade() {
    const newEntry: TradeJournalEntry = {
      id: makeJournalId(),
      createdAt: new Date().toISOString(),
      side,
      entry: parseNumOrNull(entry),
      stop: parseNumOrNull(stop),
      tp: parseNumOrNull(tp),
      result,
      setupType,
      regimeAtEntry,
      tradeGateAtEntry,
      riskPresetUsed,
      notes: notes.trim(),
      mistakeTag,
    };
    setEntries((prev) => [newEntry, ...prev]);
    resetForm();
  }

  function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Clear the entire trade journal? This cannot be undone.");
      if (!ok) return;
    }
    setEntries([]);
  }

  // Stats
  const total = entries.length;
  let wins = 0;
  let losses = 0;
  let breakEvens = 0;
  let skipped = 0;
  const mistakeCounts: Record<JournalMistakeTag, number> = {
    "none": 0,
    "late-entry": 0,
    "early-entry": 0,
    "moved-stop": 0,
    "ignored-gate": 0,
    "oversized": 0,
    "revenge-trade": 0,
    "no-confirmation": 0,
    "poor-tp": 0,
  };
  for (const e of entries) {
    if (e.result === "win") wins += 1;
    else if (e.result === "loss") losses += 1;
    else if (e.result === "break-even") breakEvens += 1;
    else if (e.result === "skipped") skipped += 1;
    if (e.mistakeTag in mistakeCounts) mistakeCounts[e.mistakeTag] += 1;
  }
  const decisive = wins + losses;
  const winRate = decisive > 0 ? Math.round((wins / decisive) * 100) : 0;

  let topMistake: JournalMistakeTag | null = null;
  let topMistakeCount = 0;
  (Object.keys(mistakeCounts) as JournalMistakeTag[]).forEach((k) => {
    if (k === "none") return;
    if (mistakeCounts[k] > topMistakeCount) {
      topMistakeCount = mistakeCounts[k];
      topMistake = k;
    }
  });

  const formGrid: React.CSSProperties = {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  };

  return (
    <section
      style={{
        width: "100%",
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.10)",
        background:
          "linear-gradient(135deg, rgba(11,18,32,0.98) 0%, rgba(11,16,32,0.98) 48%, rgba(5,7,13,0.98) 100%)",
        padding: 22,
        boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
        color: "#fff",
      }}
    >
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: "rgba(103,232,249,0.70)",
            }}
          >
            Phase 6.7
          </p>
          <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 800, color: "#fff" }}>
            Trade Journal + Outcome Tracker
          </h2>
          <p style={{ margin: "10px 0 0 0", fontSize: 15, color: "rgba(255,255,255,0.64)" }}>
            Log real trades, review outcomes, and spot repeat mistakes. Stored locally in your browser only.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone="blue">LOCAL ONLY</Badge>
          <button
            onClick={clearAll}
            style={{
              borderRadius: 14,
              border: "1px solid rgba(239,68,68,0.28)",
              background: "rgba(239,68,68,0.10)",
              color: "#fca5a5",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear Journal
          </button>
        </div>
      </div>

      {/* Card 1: Log Trade Form */}
      <div style={cardStyle({ marginBottom: 18 })}>
        <div
          style={{
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>Log Trade</h3>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>
            Regime: {regimeAtEntry} · Gate: {tradeGateAtEntry}
          </span>
        </div>

        <div style={formGrid}>
          <div>
            <p style={labelStyle()}>Side</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["long", "short"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    border:
                      side === s
                        ? "1px solid rgba(34,211,238,0.35)"
                        : "1px solid rgba(255,255,255,0.10)",
                    background: side === s ? "rgba(34,211,238,0.10)" : "rgba(0,0,0,0.20)",
                    color: "#fff",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={labelStyle()}>Entry</p>
            <input
              type="number"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              style={journalInputStyle()}
              placeholder="e.g. 67000"
            />
          </div>

          <div>
            <p style={labelStyle()}>Stop</p>
            <input
              type="number"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              style={journalInputStyle()}
              placeholder="e.g. 66500"
            />
          </div>

          <div>
            <p style={labelStyle()}>Take Profit</p>
            <input
              type="number"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              style={journalInputStyle()}
              placeholder="e.g. 68000"
            />
          </div>

          <div>
            <p style={labelStyle()}>Result</p>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value as JournalResult)}
              style={journalInputStyle()}
            >
              {RESULT_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelStyle()}>Setup Type</p>
            <select
              value={setupType}
              onChange={(e) => setSetupType(e.target.value as JournalSetupType)}
              style={journalInputStyle()}
            >
              {SETUP_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p style={labelStyle()}>Risk Preset Used</p>
            <select
              value={riskPresetUsed}
              onChange={(e) => setRiskPresetUsed(e.target.value)}
              style={journalInputStyle()}
            >
              <option value="conservative">conservative</option>
              <option value="balanced">balanced</option>
              <option value="aggressive">aggressive</option>
            </select>
          </div>

          <div>
            <p style={labelStyle()}>Mistake Tag</p>
            <select
              value={mistakeTag}
              onChange={(e) => setMistakeTag(e.target.value as JournalMistakeTag)}
              style={journalInputStyle()}
            >
              {MISTAKE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <p style={labelStyle()}>Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What worked, what didn't, what to fix next time..."
            rows={3}
            style={{
              ...journalInputStyle(),
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={logTrade}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(16,185,129,0.35)",
              background: "rgba(16,185,129,0.14)",
              color: "#86efac",
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            + LOG TRADE
          </button>
          <button
            onClick={resetForm}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.20)",
              color: "rgba(255,255,255,0.80)",
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Card 2: Outcome Tracker / Stats */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 18,
        }}
      >
        <MetricCard label="Total Trades" value={String(total)} tone="neutral" />
        <MetricCard label="Wins" value={String(wins)} tone="green" />
        <MetricCard label="Losses" value={String(losses)} tone="red" />
        <MetricCard label="Break-even" value={String(breakEvens)} tone="yellow" />
        <MetricCard label="Skipped" value={String(skipped)} tone="blue" />
        <MetricCard
          label="Win Rate"
          value={`${winRate}%`}
          tone={winRate >= 55 ? "green" : winRate >= 40 ? "yellow" : "red"}
        />
      </div>

      {/* Card 3: Mistake Patterns */}
      <div style={cardStyle({ marginBottom: 18 })}>
        <div
          style={{
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>Mistake Patterns</h3>
          <Badge tone={topMistake ? "red" : "green"}>
            {topMistake ? `TOP: ${topMistake}` : "NO MISTAKES LOGGED"}
          </Badge>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          {(Object.keys(mistakeCounts) as JournalMistakeTag[])
            .filter((k) => k !== "none")
            .map((k) => (
              <div
                key={k}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.20)",
                  borderRadius: 14,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.82)" }}>{k}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                  {mistakeCounts[k]}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Card 4: Recent Trades */}
      <div style={cardStyle()}>
        <div
          style={{
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>Recent Trades</h3>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>
            Showing {Math.min(entries.length, 20)} of {entries.length}
          </span>
        </div>

        {!hydrated ? (
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
            Loading journal…
          </p>
        ) : entries.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
            No trades logged yet. Use the form above to add your first one.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {entries.slice(0, 20).map((e) => {
              const sideTone: Tone = e.side === "long" ? "green" : "red";
              const resultTone: Tone =
                e.result === "win"
                  ? "green"
                  : e.result === "loss"
                  ? "red"
                  : e.result === "break-even"
                  ? "yellow"
                  : "blue";
              return (
                <div
                  key={e.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.22)",
                    borderRadius: 16,
                    padding: 14,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge tone={sideTone}>{e.side.toUpperCase()}</Badge>
                      <Badge tone={resultTone}>{e.result.toUpperCase()}</Badge>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                        {formatJournalDateUTC(e.createdAt)}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteEntry(e.id)}
                      style={{
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.28)",
                        background: "rgba(239,68,68,0.10)",
                        color: "#fca5a5",
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    <div>Entry: <strong style={{ color: "#fff" }}>{e.entry ?? "—"}</strong></div>
                    <div>Stop: <strong style={{ color: "#fff" }}>{e.stop ?? "—"}</strong></div>
                    <div>TP: <strong style={{ color: "#fff" }}>{e.tp ?? "—"}</strong></div>
                    <div>Setup: <strong style={{ color: "#fff" }}>{e.setupType}</strong></div>
                    <div>Regime: <strong style={{ color: "#fff" }}>{e.regimeAtEntry}</strong></div>
                    <div>Gate: <strong style={{ color: "#fff" }}>{e.tradeGateAtEntry}</strong></div>
                    <div>Risk: <strong style={{ color: "#fff" }}>{e.riskPresetUsed}</strong></div>
                    <div>Mistake: <strong style={{ color: "#fff" }}>{e.mistakeTag}</strong></div>
                  </div>

                  {e.notes ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.72)",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        paddingTop: 8,
                      }}
                    >
                      {e.notes}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}


export default function DashboardClientPhase62() {
  const [panelData, setPanelData] = useState<RegimeResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/regime", { cache: "no-store" });
        const json = await res.json();
        if (mounted) setPanelData(json);
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#05070d", color: "#fff" }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "24px 16px 48px",
          display: "grid",
          gap: 24,
        }}
      >
        <HeroDecisionPanel data={panelData} />
        <DashboardClientPhase60Base />
        <RegimePanel />
        <PositionSizingPanel data={panelData} />
        <ExecutionPlanPanel data={panelData} />
        <TradeJournalPanel data={panelData} />
      </div>
    </main>
  );
}