import type { MetadataRoute } from 'next';
import { APP_DESCRIPTION, APP_NAME, BRAND } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRAND.night,
    theme_color: BRAND.night,
    categories: ['utilities', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Setup guide', short_name: 'Guide', url: '/guide', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Wake history', short_name: 'History', url: '/history', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
