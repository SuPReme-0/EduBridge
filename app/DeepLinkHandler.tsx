'use client';

import { useEffect } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useRouter } from 'next/navigation';

// Helper to detect native app
const isNative = () => {
  if (typeof window === 'undefined') return false;
  return (window as any).Capacitor?.isNativePlatform?.() || false;
};

export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;

    const handleUrlOpen = async (event: URLOpenListenerEvent) => {
      if (event.url.startsWith('com.priyanshu.edubridge://auth')) {
        // The URL will look like: com.priyanshu.edubridge://auth#access_token=...
        const urlObj = new URL(event.url);
        
        // Pass the tokens to the Next.js server route to set secure cookies!
        router.push(`/auth/callback${urlObj.search}${urlObj.hash}`);
      }
    };

    App.addListener('appUrlOpen', handleUrlOpen);
    
    return () => {
      App.removeAllListeners();
    };
  }, [router]);

  return null;
}