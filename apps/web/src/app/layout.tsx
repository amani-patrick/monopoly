import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/Toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Umukino — Rwanda Monopoly',
  description: 'Real-money Monopoly board game. Play with friends. Win in RWF.',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Umukino',
    description: 'Real-money Monopoly. Pay with MTN MoMo, Airtel Money, or USDT.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0f0f1a] text-white antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
