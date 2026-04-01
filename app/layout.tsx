import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BTC/USDT Live Dashboard',
  description: 'Hosted BTC dashboard with fallback-first live market data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
