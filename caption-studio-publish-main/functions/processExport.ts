import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Reject loopback/link-local/private/internal hosts so a user-supplied
// `file_url` can't drive server-side requests (directly here or via the
// downstream transcribe/render services) at internal infrastructure (SSRF).
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.internal') || host.endsWith('.local')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

function isSafeFetchUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && !isBlockedHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Main export processing function
 * Orchestrates: Credit check -> Transcribe -> Translate -> Create Job
 * 
 * Note: FFmpeg rendering requires external service (Replit/VPS)
 * This function prepares the job and returns captions for client-side preview
 * or triggers external render service via webhook
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      file_url, 
      target_language = 'hindi',
      font_name = 'NotoSansDevanagari-Bold',
      font_size = 48,
      position = 'bottom',
      captions = null // Pre-existing captions (skip transcription)
    } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    if (!isSafeFetchUrl(file_url)) {
      return Response.json({ error: 'file_url must be a public https URL' }, { status: 400 });
    }

    // Step 1: Check credits
    const creditsCheck = await base44.functions.invoke('manageCredits', { action: 'get' });

    if (!creditsCheck.data?.success || creditsCheck.data?.credits?.remaining <= 0) {
      return Response.json({
        success: false,
        error: 'No credits remaining. Please upgrade your plan.',
        credits_remaining: 0
      });
    }

    // Step 2: Create render job record
    const job = await base44.asServiceRole.entities.RenderJob.create({
      user_id: user.email,
      file_url: file_url,
      status: 'pending',
      target_language: target_language,
      font_name: font_name,
      font_size: font_size,
      position: position
    });

    let translatedCaptions = captions;

    // Step 3: If no pre-existing captions, run AI pipeline
    if (!translatedCaptions) {
      // Update status
      await base44.asServiceRole.entities.RenderJob.update(job.id, { 
        status: 'transcribing' 
      });

      // Transcribe
      const transcribeResult = await base44.functions.invoke('transcribeVideo', { 
        file_url: file_url 
      });

      if (!transcribeResult.data?.success) {
        await base44.asServiceRole.entities.RenderJob.update(job.id, { 
          status: 'failed',
          error_message: transcribeResult.data?.error || 'Transcription failed'
        });
        return Response.json({
          success: false,
          error: 'Transcription failed',
          job_id: job.id
        });
      }

      // Update status
      await base44.asServiceRole.entities.RenderJob.update(job.id, { 
        status: 'translating' 
      });

      // Translate
       const translateResult = await base44.functions.invoke('translateCaptions', {
        segments: transcribeResult.data.segments,
        source_language: transcribeResult.data.language || 'english',
        target_language: target_language
      });

      if (!translateResult.data?.success) {
        await base44.asServiceRole.entities.RenderJob.update(job.id, { 
          status: 'failed',
          error_message: translateResult.data?.error || 'Translation failed'
        });
        return Response.json({
          success: false,
          error: 'Translation failed',
          job_id: job.id
        });
      }

      translatedCaptions = translateResult.data.segments;
    }

    // Step 4: Save captions to job
    await base44.asServiceRole.entities.RenderJob.update(job.id, { 
      status: 'rendering',
      captions: translatedCaptions
    });

    // Step 5: Deduct credit
    await base44.functions.invoke('manageCredits', { action: 'deduct' });

    // Step 6: Return job info (client can poll for status or use captions directly)
    // Note: Actual FFmpeg rendering would be handled by external VPS/Replit service
    // The job_id can be sent to that service via webhook

    return Response.json({
      success: true,
      job_id: job.id,
      status: 'rendering',
      captions: translatedCaptions,
      credits_remaining: creditsCheck.data.credits.remaining - 1,
      message: 'Export job created. Captions ready for preview.',
      render_config: {
        font_name,
        font_size,
        position,
        target_language
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});