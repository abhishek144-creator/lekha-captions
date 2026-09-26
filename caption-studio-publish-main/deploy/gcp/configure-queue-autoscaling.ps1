param(
    [string]$ProjectId = "project-0cc7c839-b9c7-4734-ad0",
    [string]$Region = "asia-south1",
    [string]$WorkerGroup = "lekha-worker-staging-mig",
    [string]$TranscriptionGroup = "lekha-transcription-staging-mig",
    [string]$ExportQueue = "render_all",
    [string]$TranscriptionQueue = "caption_transcription_jobs"
)

$ErrorActionPreference = "Stop"

# Run after the API has published pending work and predicted wait metrics.
& gcloud compute instance-groups managed set-autoscaling $WorkerGroup `
    --project=$ProjectId --region=$Region `
    --min-num-replicas=3 --max-num-replicas=20 `
    --cool-down-period=180 `
    --mode=on `
    '--scale-in-control=max-scaled-in-replicas=5,time-window=300' `
    --update-stackdriver-metric=custom.googleapis.com/lekha/pending_render_work_seconds `
    "--stackdriver-metric-filter=resource.type = global AND metric.labels.queue = $ExportQueue AND metric.labels.worker_group = $WorkerGroup" `
    --stackdriver-metric-single-instance-assignment=1 `
    --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Queue-driven worker autoscaling configuration failed"
}

& gcloud compute instance-groups managed set-autoscaling $TranscriptionGroup `
    --project=$ProjectId --region=$Region `
    --min-num-replicas=0 --max-num-replicas=10 `
    --cool-down-period=180 `
    --mode=on `
    '--scale-in-control=max-scaled-in-replicas=2,time-window=300' `
    --update-stackdriver-metric=custom.googleapis.com/lekha/transcription_queue_depth `
    "--stackdriver-metric-filter=resource.type = global AND metric.labels.queue = $TranscriptionQueue AND metric.labels.worker_group = $TranscriptionGroup" `
    --stackdriver-metric-single-instance-assignment=120 `
    --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Queue-driven transcription autoscaling configuration failed"
}
