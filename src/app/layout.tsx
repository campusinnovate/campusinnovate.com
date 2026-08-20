import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://campusinnovate.com'),
  title: 'Campus Innovate — Grow People, Strengthen Teams',
  description: 'Program leadership, organization development, mentoring, dan capacity building yang dirancang sesuai kebutuhan tim.',
  authors: [{ name: 'Zidane Ibrahim Fadela' }],
  icons: {
    icon: '/assets/logos/logo-campus-innovate.png',
  },
  openGraph: {
    type: 'website',
    title: 'Campus Innovate — Grow People, Strengthen Teams',
    description: 'Pengalaman belajar yang membantu individu bertumbuh dan organisasi bergerak lebih kuat.',
    images: [{ url: '/og.png', width: 1734, height: 907, alt: 'Campus Innovate — Grow People. Strengthen Teams.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Campus Innovate — Grow People, Strengthen Teams',
    description: 'Pengalaman belajar yang membantu individu bertumbuh dan organisasi bergerak lebih kuat.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
