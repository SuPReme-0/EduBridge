import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function DELETE(req: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate Limiting (Very Strict for Security)
    const clientIp = getClientIdentifier(req);
    const rateLimit = await checkRateLimit(rateLimiters.deleteAccount, clientIp);

    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          error: 'Too many delete attempts. Please wait before trying again.',
          retryAfter: rateLimit.reset
        }, 
        { status: 429 }
      );
    }

    // Authenticate
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify confirmation header (extra security)
    const confirmDelete = req.headers.get('X-Confirm-Delete');
    if (confirmDelete !== 'true') {
      return NextResponse.json(
        { 
          error: 'Account deletion requires confirmation.',
          requiresConfirmation: true
        }, 
        { status: 403 }
      );
    }

    // Delete in Transaction (All or Nothing)
    await prisma.$transaction(async (tx) => {
      // 1. Delete all related records first (cascade should handle most)
      await tx.doubtSession.deleteMany({ where: { userId: user.id } });
      await tx.progress.deleteMany({ where: { userId: user.id } });
      await tx.achievement.deleteMany({ where: { userId: user.id } });
      await tx.feedback.deleteMany({ where: { userId: user.id } });
      
      // 2. Delete curriculums
      const curriculums = await tx.curriculum.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      
      for (const curr of curriculums) {
        await tx.curriculum.delete({ where: { id: curr.id } });
      }
      
      // 3. Delete profile – use deleteMany to avoid error if profile doesn't exist
      await tx.profile.deleteMany({ where: { userId: user.id } });
      
      // 4. Delete audit logs
      await tx.auditLog.deleteMany({ where: { userId: user.id } });
    });

    // 5. Delete from Supabase Auth (Admin operation)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      throw new Error(`Auth deletion failed: ${authDeleteError.message}`);
    }

    // 6. Sign out the user to clear the session cookie
    await supabase.auth.signOut();

    const duration = Date.now() - startTime;
    console.log(`[Delete Account] Success in ${duration}ms | User: ${user.id} | Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully. We are sorry to see you go.',
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Delete Account] Error in ${duration}ms | Request: ${requestId}`, error);

    return NextResponse.json(
      { error: 'Failed to delete account. Please contact support.' }, 
      { status: 500 }
    );
  }
}