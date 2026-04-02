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

export type SignalStrength = 'low' | 'medium' | 'high';
export type SignalType =
  | 'confirmed-long'
  | 'aggressive-long'
  | 'confirmed-short'
  | 'aggressive-short'
  | 'breakout-watch'
  | 'liquidity-sweep-watch'
  | 'wait';

export type ExecutionTone = 'good' | 'neutral' | 'warning' | 'danger';
export type ExecutionLocation = 'active' | 'early' | 'late' | 'invalid';

export type SignalCard = {
  title: string;
  direction: Bias;
  type: SignalType;
  strength: SignalStrength;
  trigger: string;
  note: string;
  invalidation: string;
  risk: string;
};

export type ExecutionState = {
  longLocation: ExecutionLocation;
  shortLocation: ExecutionLocation;
  longQuality: number;
  shortQuality: number;
  longRiskState: string;
  shortRiskState: string;
  longExecutionNote: string;
  shortExecutionNote: string;
  longTone: ExecutionTone;
  shortTone: ExecutionTone;
};

export type DashboardContext = {
  canTradeNow?: boolean;
  tradeReadiness?: number;
  smartEdge?: number;

  longExecution?: number;
  shortExecution?: number;
  preferredSide?: 'LONG' | 'SHORT' | 'NEUTRAL';
  executionComment?: string;

  longReasons?: string[];
  shortReasons?: string[];

  whyLong?: string[];
  whyShort?: string[];
  longConfirmations?: string[];
  shortConfirmations?: string[];
  longInvalidations?: string[];
  shortInvalidations?: string[];
  avoidTradeReason?: string;

  longEntryQuality?: 'EARLY' | 'GOOD' | 'LATE' | 'CHASE';
  shortEntryQuality?: 'EARLY' | 'GOOD' | 'LATE' | 'CHASE';
  longChaseWarning?: string;
  shortChaseWarning?: string;
  entryComment?: string;
  bestEntrySide?: 'LONG' | 'SHORT' | 'WAIT';
  entryDistancePct?: number;

  longTriggerState?: 'WATCH' | 'TRIGGERING' | 'CONFIRMED' | 'FAILED';
  shortTriggerState?: 'WATCH' | 'TRIGGERING' | 'CONFIRMED' | 'FAILED';
  longConfirmationScore?: number;
  shortConfirmationScore?: number;
  bestActiveTrigger?: 'LONG' | 'SHORT' | 'WAIT';
  triggerComment?: string;
  triggerFailureWarning?: string;

  dxy?: string;
  spy?: string;
  ethbtc?: string;
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
  trendState: 'uptrend' | 'downtrend' | 'range';
  swingHigh: number;
  swingLow: number;
  biasFlipLevel: number;

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

  execution: ExecutionState;
  context?: DashboardContext;

  dxy: string;
  spy: string;
  ethbtc: string;

  candles: Candle[];
  signals: SignalCard[];
};