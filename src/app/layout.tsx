import type { Metadata } from 'next';
import './globals.css';
import './ruang-kawan-modules.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://campusinnovate.com'),
  title: {
    default: 'Campus Innovate - Building Systems. Developing Leaders.',
    template: '%s | Campus Innovate',
  },
  description: 'Campus Innovate is an educational solutions partner for impactful programs, efficient systems, and meaningful learning experiences.',
  authors: [{ name: 'Campus Innovate' }],
  alternates: { canonical: '/home' },
  icons: {
    icon: '/assets/brand/campus-innovate-official.png',
  },
  openGraph: {
    type: 'website',
    url: '/home',
    siteName: 'Campus Innovate',
    title: 'Campus Innovate - Building Systems. Developing Leaders.',
    description: 'Impactful programs, efficient systems, and meaningful learning experiences for institutions and future leaders.',
    images: [{ url: '/assets/site-2026/hero-team.jpg', width: 2000, height: 1333, alt: 'Campus Innovate team' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Campus Innovate - Building Systems. Developing Leaders.',
    description: 'Impactful programs, efficient systems, and meaningful learning experiences.',
    images: ['/assets/site-2026/hero-team.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}