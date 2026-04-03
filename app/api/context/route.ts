import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const context = {
      dxy: 'DXY slightly firm',
      spy: 'SPY mixed / range',
      ethbtc: 'ETH/BTC weak',
      operatorRead: 'Short side has better alignment right now.',

      longWhy: [
        'Long side lacks strong directional alignment',
        'Momentum is not clearly supporting upside continuation',
      ],

      shortWhy: [
        'Bearish trend alignment',
        'Price below short-term trend',
        'Price below medium-term trend',
        'RSI supports bearish continuation',
      ],

      whyThisSetup: [
        'Price is holding below EMA20.',
        'Price is holding below EMA50.',
        'Momentum structure favors downside continuation.',
        'RSI is in bearish continuation zone.',
      ],

      whatConfirms: [
        'Stay below EMA20.',
        'Stay below EMA50.',
        'Momentum continues lower.',
        'RSI remains below 50.',
      ],

      whatInvalidates: [
        'Reclaim EMA20.',
        'Reclaim EMA50.',
        'Momentum flips against shorts.',
        'Bearish follow-through fails after trigger.',
      ],

      avoidTradeIf:
        'Avoid chasing if price stretches too far from the best entry area.',
    };

    return NextResponse.json(context);
  } catch (error) {
    console.error('Context route failed:', error);

    return NextResponse.json(
      {
        dxy: 'Unavailable',
        spy: 'Unavailable',
        ethbtc: 'Unavailable',
        operatorRead: 'Context route failed.',
        longWhy: ['Context route failed'],
        shortWhy: ['Context route failed'],
        whyThisSetup: ['Context route failed'],
        whatConfirms: ['Context route failed'],
        whatInvalidates: ['Context route failed'],
        avoidTradeIf: 'Avoid trading until context route is fixed.',
      },
      { status: 200 }
    );
  }
}