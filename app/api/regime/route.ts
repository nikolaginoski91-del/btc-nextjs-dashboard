// app/api/regime/route.ts

import { NextResponse } from "next/server";
import { classifyRegime, type RegimeInput } from "@/lib/regime-engine";
import { FALLBACK_CANDLES, buildStateFromCandles } from "@/lib/market";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildRegimeInputFromMarketState() {
  const candles = FALLBACK_CANDLES["4h"];
  const state = buildStateFromCandles(candles, new Date().toISOString());

  const price = Number(state.price ?? 0);
  const ema20 = Number(state.ema21 ?? 0);
  const ema50 = Number(state.ema50 ?? 0);
  const ema200 = Number(state.ema200 ?? 0);
  const rsi = Number(state.rsi ?? 50);

  const recent = candles.slice(-14);
  const avgRange =
    recent.reduce((sum, c) => sum + Math.abs(c.high - c.low), 0) /
    Math.max(recent.length, 1);
  const atrPercent = price ? (avgRange / price) * 100 : 2;

  const avgVol =
    recent.reduce((sum, c) => sum + Number(c.volume || 0), 0) /
    Math.max(recent.length, 1);
  const lastVol = Number(candles[candles.length - 1]?.volume || avgVol || 1);
  const volumeRatio = avgVol ? lastVol / avgVol : 1;

  let trendStrength = 50;

  if (state.trendState === "uptrend") trendStrength = 78;
  else if (state.trendState === "downtrend") trendStrength = 78;
  else trendStrength = 42;

  if (state.confidence === "high") trendStrength += 10;
  if (state.confidence === "low") trendStrength -= 8;

  trendStrength = clamp(Math.round(trendStrength), 5, 100);

  const input: RegimeInput = {
    price,
    ema20,
    ema50,
    ema200,
    rsi,
    atrPercent,
    volumeRatio,
    trendStrength,
  };

  return {
    input,
    state,
  };
}

export async function GET() {
  try {
    const { input, state } = buildRegimeInputFromMarketState();
    const result = classifyRegime(input);

    return NextResponse.json({
      ok: true,
      source: "live_market_state",
      isLive: true,
      input,
      result,
      syncedFrom: {
        bias: state.bias,
        trendState: state.trendState,
        structure: state.structure,
        preferredSide: state.context?.preferredSide ?? "NEUTRAL",
        mtfAlignment: "unknown",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to calculate regime from market state.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const input: RegimeInput = {
      price: Number(body?.price ?? 0),
      ema20: Number(body?.ema20 ?? 0),
      ema50: Number(body?.ema50 ?? 0),
      ema200: Number(body?.ema200 ?? 0),
      rsi: Number(body?.rsi ?? 50),
      atrPercent: Number(body?.atrPercent ?? 2),
      volumeRatio: Number(body?.volumeRatio ?? 1),
      trendStrength: Number(body?.trendStrength ?? 50),
    };

    const result = classifyRegime(input);

    return NextResponse.json({
      ok: true,
      source: "manual_post",
      isLive: false,
      input,
      result,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid regime payload.",
      },
      { status: 400 }
    );
  }
}