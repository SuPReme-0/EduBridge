'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthListener({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state changes (session expiry)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        // Session expired or user signed out – redirect to root
        router.push('/');
      }
    });

    // Check if profile exists for logged-in user (optional, can be done on page level)
    const checkProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const res = await fetch('/api/profile/me');
          if (res.status === 404) {
            // Profile not found – redirect to root
            router.push('/');
          }
        } catch (e) {
          console.error('Profile check failed', e);
        }
      }
    };
    checkProfile();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}