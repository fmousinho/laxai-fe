
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { LoggerInitializer } from '@/components/LoggerInitializer';
// ...existing imports...

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LaxAI',
  description:
    'AI-Powered Lacrosse performance analysis platform',
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
        <body className="flex min-h-screen w-full flex-col">
          <LoggerInitializer />
          {children}
        </body>
        <Analytics />
    </html>
  );
}
