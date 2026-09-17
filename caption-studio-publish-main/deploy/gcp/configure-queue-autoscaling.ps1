param(
    [string]$ProjectId = "project-0cc7c839-b9c7-4734-ad0",
    [string]$Region = "asia-south1",
    [string]$WorkerGroup = "lekha-worker-staging-mig"
)

$ErrorActionPreference = "Stop"

# Run after the API has published custom.googleapis.com/lekha/export_queue_depth.
# CPU remains a fallback signal; Compute Engine uses the largest recommendation.
& gcloud compute instance-groups managed set-autoscaling $WorkerGroup `
    --project=$ProjectId --region=$Region `
    --min-num-replicas=3 --max-num-replicas=20 `
    --target-cpu-utilization=0.45 --cool-down-period=180 `
    --mode=on `
    '--scale-in-control=max-scaled-in-replicas=1,time-window=600' `
    --update-stackdriver-metric=custom.googleapis.com/lekha/export_queue_depth `
    '--stackdriver-metric-filter=resource.type = global AND metric.labels.queue = caption_export_jobs AND metric.labels.worker_group = lekha-worker-staging-mig' `
    --stackdriver-metric-single-instance-assignment=1 `
    --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Queue-driven worker autoscaling configuration failed"
}
