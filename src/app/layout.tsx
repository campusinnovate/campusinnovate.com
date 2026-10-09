import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import './ruang-kawan-modules.css';
import './ruang-kawan-chat.css';
import './ruang-kawan-ai.css';
import './ruang-kawan-office.css';

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
      <body>
        <Script id="google-ads-campus-innovate" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18473450758');
          `}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18473450758"
          strategy="afterInteractive"
        />
        <Script id="google-ads-whatsapp-conversion" strategy="afterInteractive">
          {`
            document.addEventListener('click', function (event) {
              if (!(event.target instanceof Element)) return;
              var link = event.target.closest('a[href*="wa.me/6285882514394"]');
              if (!link) return;
              gtag('event', 'conversion', {
                'send_to': 'AW-18473450758/iaLBCN-i35AdEIb66ehE',
                'event_category': link.dataset.service || 'whatsapp',
                'event_label': link.dataset.ctaPlacement || 'general'
              });
            });
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
