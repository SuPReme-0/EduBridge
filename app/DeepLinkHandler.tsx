'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase/client';

// Helper to detect native app
const isNative = () => {
  if (typeof window === 'undefined') return false;
  return (window as any).Capacitor?.isNativePlatform?.() || false;
};

export default function DeepLinkHandler() {
  useEffect(() => {
    if (!isNative()) return;

    const handleUrlOpen = async ({ url }: { url: string }) => {
      // Replace with your actual custom scheme
      if (url.startsWith('com.yourcompany.edubridge://auth')) {
        // Parse the URL fragment (after #)
        const hash = url.split('#')[1];
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token) {
          await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || '',
          });
        }
        // Close the browser tab after successful sign-in
        await Browser.close();
      }
    };

    App.addListener('appUrlOpen', handleUrlOpen);
    return () => {
      App.removeAllListeners();
    };
  }, []);

  return null; // This component doesn't render anything
}