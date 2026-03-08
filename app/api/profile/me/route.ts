import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.profileRead, clientIp);

    if (!rateLimit.success) {
      console.warn(`[Profile GET] Rate limited: ${clientIp}`);
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.reset 
        }, 
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          }
        }
      );
    }

    // Authenticate Request
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error(`[Profile GET] Auth error: ${authError?.message}`);
      return NextResponse.json(
        { error: 'Unauthorized. Please log in again.' }, 
        { status: 401 }
      );
    }

    // Fetch Profile + Curriculums
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      include: {
        user: { 
          select: { 
            id: true,
            email: true,
            role: true,
            status: true,
            curriculums: {
              orderBy: { createdAt: 'desc' },
              include: {
                subjects: {
                  orderBy: { order: 'asc' },
                  include: {
                    chapters: {
                      select: { 
                        id: true, 
                        title: true, 
                        status: true, 
                        chapterNumber: true, 
                        estimatedMinutes: true,
                        difficultyLevel: true,
                        tags: true,
                      },
                      orderBy: { chapterNumber: 'asc' }
                    }
                  }
                }
              }
            }
          } 
        },
      },
    });

    // Create Profile if doesn't exist (First-time user)
    if (!profile) {
      console.log(`[Profile GET] Creating new user and profile for: ${user.id}`);
      
      // ✅ PROPER FIX: We MUST ensure the User exists in the public table before creating a Profile.
      // This prevents the P2003 Foreign Key Constraint error.
      await prisma.user.upsert({
        where: { id: user.id },
        update: {}, // Do nothing if they already exist
        create: {
          id: user.id,
          email: user.email || '',
        }
      });

      // Now it is safe to create the profile
      const newProfile = await prisma.profile.create({
        data: {
          userId: user.id,
          fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
          currentVibe: 'minimalist',
          learningTempo: 'NORMAL',
          classLevel: 0,
          board: '',
        },
        include: {
          user: { 
            select: { 
              id: true,
              email: true,
              role: true,
              status: true,
              curriculums: {
                include: {
                  subjects: {
                    include: {
                      chapters: true
                    }
                  }
                }
              }
            } 
          },
        },
      });

      const duration = Date.now() - startTime;
      console.log(`[Profile GET] Profile created in ${duration}ms | Request: ${requestId}`);

      return NextResponse.json({ 
        success: true, 
        profile: newProfile,
        createdAt: true,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Profile GET] Success in ${duration}ms | Request: ${requestId}`);

    return NextResponse.json({ 
      success: true, 
      profile,
    }, {
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.reset.toString(),
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Profile GET] Error in ${duration}ms | Request: ${requestId}`, error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve profile data.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    );
  }
}