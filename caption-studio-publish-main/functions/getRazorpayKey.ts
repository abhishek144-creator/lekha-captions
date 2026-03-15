import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return the Razorpay key ID (public key is safe to expose)
    const razorpayKeyId = Deno.env.get("razor_pay_key_id");

    if (!razorpayKeyId) {
      return Response.json({ error: 'Razorpay not configured' }, { status: 500 });
    }

    return Response.json({ key_id: razorpayKeyId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});