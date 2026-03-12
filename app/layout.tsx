import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AuthListener from './AuthListener';
import DeepLinkHandler from './DeepLinkHandler';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Neural Matrix Learning',
  description: 'Futuristic AI-powered learning platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="font-sans bg-[#050505] text-slate-200 antialiased">
        <DeepLinkHandler />
        <AuthListener>
          {children}
        </AuthListener>
      </body>
    </html>
  );
}