// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 2. SERVER CLIENT (For Server Components, Server Actions, and API Routes)
// ============================================================================
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored safely because middleware handles refreshing cookies.
          }
        },
      },
    }
  );
}

// ============================================================================
// 3. ADMIN CLIENT (For Background Jobs like Inngest - BYPASSES RLS POLICIES)
// ============================================================================
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // 🚨 Requires this key in .env
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false, 
      },
    }
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
export async function getSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}