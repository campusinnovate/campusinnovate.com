import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'
 
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://campusinnovate.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://campusinnovate.com/home',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://campusinnovate.com/privacy',
      lastModified: new Date('2026-08-24'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
