import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();
    // action: 'get', 'deduct', 'reset'

    // Find or create user credits
    let userCredits = await base44.asServiceRole.entities.UserCredits.filter({
      user_email: user.email
    });

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    if (!userCredits || userCredits.length === 0) {
      // Create new credit record for Plan B (30 credits/month)
      const newCredits = await base44.asServiceRole.entities.UserCredits.create({
        user_email: user.email,
        plan: 'B',
        credits_total: 30,
        credits_used: 0,
        credits_remaining: 30,
        reset_date: nextMonth.toISOString().split('T')[0]
      });
      userCredits = [newCredits];
    }

    let credits = userCredits[0];

    // Check if credits should reset (new month)
    const resetDate = new Date(credits.reset_date);
    if (now >= resetDate) {
      await base44.asServiceRole.entities.UserCredits.update(credits.id, {
        credits_used: 0,
        credits_remaining: credits.credits_total,
        reset_date: nextMonth.toISOString().split('T')[0]
      });
      credits.credits_used = 0;
      credits.credits_remaining = credits.credits_total;
    }

    // Handle actions
    if (action === 'get') {
      return Response.json({
        success: true,
        credits: {
          plan: credits.plan,
          total: credits.credits_total,
          used: credits.credits_used,
          remaining: credits.credits_remaining,
          reset_date: credits.reset_date
        }
      });
    }

    if (action === 'deduct') {
      if (credits.credits_remaining <= 0) {
        return Response.json({
          success: false,
          error: 'No credits remaining',
          credits: {
            remaining: 0,
            plan: credits.plan
          }
        });
      }

      await base44.asServiceRole.entities.UserCredits.update(credits.id, {
        credits_used: credits.credits_used + 1,
        credits_remaining: credits.credits_remaining - 1,
        last_render_date: now.toISOString()
      });

      return Response.json({
        success: true,
        credits: {
          plan: credits.plan,
          total: credits.credits_total,
          used: credits.credits_used + 1,
          remaining: credits.credits_remaining - 1
        }
      });
    }

    if (action === 'reset') {
      // Admin only - reset credits
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }

      await base44.asServiceRole.entities.UserCredits.update(credits.id, {
        credits_used: 0,
        credits_remaining: credits.credits_total
      });

      return Response.json({
        success: true,
        message: 'Credits reset successfully'
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Credits error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});