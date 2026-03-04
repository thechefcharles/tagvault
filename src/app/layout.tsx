import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'TagVault',
  description: 'Store and organize your items with priority and timestamps',
  applicationName: 'TagVault',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TagVault',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#0B0B0F',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
