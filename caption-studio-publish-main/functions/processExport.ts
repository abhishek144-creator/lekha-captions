import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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