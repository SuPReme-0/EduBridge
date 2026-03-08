import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// Allowed image domains for security
const ALLOWED_IMAGE_DOMAINS = [
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'secure.gravatar.com',
  'images.unsplash.com',
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').split('.')[0] + '.supabase.co',
].filter(Boolean);

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    
    return ALLOWED_IMAGE_DOMAINS.some(domain => 
      parsed.hostname.includes(domain || '')
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.avatar, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many avatar updates. Please wait before trying again.' }, 
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse Body
    const { avatarUrl } = await req.json();

    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return NextResponse.json(
        { error: 'Invalid avatar URL provided.' }, 
        { status: 400 }
      );
    }

    // Validate URL (Security)
    if (!isValidImageUrl(avatarUrl)) {
      console.warn(`[Avatar] Invalid domain: ${avatarUrl}`);
      return NextResponse.json(
        { error: 'Avatar URL must be from a trusted source.' }, 
        { status: 400 }
      );
    }

    // Update Supabase Auth Metadata
    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl }
    });

    if (authUpdateError) {
      throw authUpdateError;
    }

    // Update Profile
    await prisma.profile.update({
      where: { userId: user.id },
      data: { avatarUrl },
    });

    const duration = Date.now() - startTime;
    console.log(`[Avatar UPDATE] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Avatar updated successfully.',
      avatarUrl,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Avatar UPDATE] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to update avatar.' }, 
      { status: 500 }
    );
  }
}