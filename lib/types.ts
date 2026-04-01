export type Timeframe = '15m' | '1h' | '4h' | '1d';
export type Bias = 'bullish' | 'bearish' | 'neutral';
export type LiveMode = 'fallback' | 'loading' | 'live-binance' | 'live-coingecko' | 'failed';

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SignalCard = {
  title: string;
  direction: Bias;
  trigger: string;
  note: string;
  invalidation: string;
  risk: string;
};

export type DashboardState = {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  updatedAt: string;
  bias: Bias;
  confidence: 'low' | 'medium' | 'high';
  structure: string;
  swingHigh: number;
  swingLow: number;
  rsi: number;
  ema21: number;
  ema50: number;
  ema200: number;
  macdState: string;
  supports: number[];
  resistances: number[];
  longEntry: [number, number];
  longStop: number;
  longTargets: number[];
  shortEntry: [number, number];
  shortStop: number;
  shortTargets: number[];
  dxy: string;
  spy: string;
  ethbtc: string;
  candles: Candle[];
  signals: SignalCard[];
};
