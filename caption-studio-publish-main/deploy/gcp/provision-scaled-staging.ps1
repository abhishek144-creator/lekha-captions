param(
    [string]$ProjectId = "project-0cc7c839-b9c7-4734-ad0",
    [string]$Region = "asia-south1",
    [string]$Release = "71831b836d6bd31ec7eee2fadda3aae5f4b76a42",
    [string]$ImageUri = "asia-south1-docker.pkg.dev/project-0cc7c839-b9c7-4734-ad0/caption-studio/app@sha256:ae882c49d5d5e4cd255de9a684f377ec9c80b145ccff9beecb96809661d10423"
)

$ErrorActionPreference = "Stop"

$zones = "asia-south1-a,asia-south1-b,asia-south1-c"
$serviceAccount = "602676673096-compute@developer.gserviceaccount.com"
$startupScript = Join-Path $PSScriptRoot "gce-startup.sh"
$suffix = $Release.Substring(0, 7)
$apiTemplate = "lekha-api-staging-$suffix-private-pdbal50"
$workerTemplate = "lekha-worker-staging-$suffix-private-pdstd50"
$apiGroup = "lekha-api-staging-mig"
$workerGroup = "lekha-worker-staging-mig"
$apiHealth = "lekha-api-staging-mig-health"
$workerHealth = "lekha-worker-staging-mig-health"

function Invoke-Gcloud {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & gcloud @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud failed: $($Arguments -join ' ')"
    }
}

function Ensure-HealthCheck {
    param([string]$Name)
    & gcloud compute health-checks describe $Name --project=$ProjectId *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Invoke-Gcloud compute health-checks create http $Name `
        --project=$ProjectId --port=8000 --request-path=/api/health/readiness `
        --check-interval=30s --timeout=10s --healthy-threshold=2 --unhealthy-threshold=3
}

function Ensure-Template {
    param(
        [string]$Name,
        [string]$Role,
        [string]$MachineType,
        [string]$Tag,
        [string]$DiskType
    )
    & gcloud compute instance-templates describe $Name --project=$ProjectId *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Invoke-Gcloud compute instance-templates create $Name `
        --project=$ProjectId --machine-type=$MachineType `
        --network=default --subnet=default --region=$Region `
        --no-address --maintenance-policy=MIGRATE `
        --service-account=$serviceAccount --scopes=cloud-platform `
        --tags=$Tag --image-family=debian-12 --image-project=debian-cloud `
        --boot-disk-size=50GB --boot-disk-type=$DiskType --boot-disk-auto-delete `
        --metadata="service-role=$Role,image-uri=$ImageUri,runtime-secret=lekha-runtime-env,region=$Region" `
        --metadata-from-file="startup-script=$startupScript"
}

$router = "lekha-egress-router"
$nat = "lekha-egress-nat"
& gcloud compute routers describe $router --project=$ProjectId --region=$Region *> $null
if ($LASTEXITCODE -ne 0) {
    Invoke-Gcloud compute routers create $router `
        --project=$ProjectId --region=$Region --network=default
}
& gcloud compute routers nats describe $nat `
    --project=$ProjectId --router=$router --region=$Region *> $null
if ($LASTEXITCODE -ne 0) {
    Invoke-Gcloud compute routers nats create $nat `
        --project=$ProjectId --router=$router --region=$Region `
        --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges `
        --min-ports-per-vm=128 --enable-logging --log-filter=ERRORS_ONLY
}

function Ensure-RegionalGroup {
    param(
        [string]$Name,
        [string]$Template,
        [int]$Size
    )
    & gcloud compute instance-groups managed describe $Name --region=$Region --project=$ProjectId *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Invoke-Gcloud compute instance-groups managed create $Name `
        --project=$ProjectId --region=$Region --zones=$zones `
        --template=$Template --size=$Size --base-instance-name=$Name
}

function Ensure-GroupTemplate {
    param(
        [string]$Name,
        [string]$Template
    )
    $currentTemplate = (& gcloud compute instance-groups managed describe $Name `
        --project=$ProjectId --region=$Region `
        --format="value(instanceTemplate.basename())").Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the active template for $Name"
    }
    if ($currentTemplate -eq $Template) { return }
    Invoke-Gcloud compute instance-groups managed rolling-action start-update $Name `
        --project=$ProjectId --region=$Region --version="template=$Template" `
        --max-surge=3 --max-unavailable=0 --minimal-action=replace
}

Ensure-HealthCheck $apiHealth
Ensure-HealthCheck $workerHealth
Ensure-Template $apiTemplate api e2-standard-2 lekha-api-mig pd-balanced
Ensure-Template $workerTemplate worker n2-custom-4-12288 lekha-worker-mig pd-standard

& gcloud compute firewall-rules describe lekha-allow-health-checks --project=$ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    Invoke-Gcloud compute firewall-rules create lekha-allow-health-checks `
        --project=$ProjectId --network=default --direction=INGRESS --action=ALLOW `
        --rules=tcp:8000 "--source-ranges=130.211.0.0/22,35.191.0.0/16" `
        "--target-tags=lekha-api-mig,lekha-worker-mig"
}

Ensure-RegionalGroup $apiGroup $apiTemplate 2
Ensure-RegionalGroup $workerGroup $workerTemplate 3

Invoke-Gcloud compute instance-groups managed set-named-ports $apiGroup `
    --project=$ProjectId --region=$Region --named-ports=http:8000
Invoke-Gcloud compute instance-groups managed update $apiGroup `
    --project=$ProjectId --region=$Region --health-check=$apiHealth --initial-delay=180
Invoke-Gcloud compute instance-groups managed update $workerGroup `
    --project=$ProjectId --region=$Region --health-check=$workerHealth --initial-delay=180 `
    --target-distribution-shape=balanced --instance-redistribution-type=none

Ensure-GroupTemplate $apiGroup $apiTemplate
Ensure-GroupTemplate $workerGroup $workerTemplate

& gcloud compute backend-services describe lekha-api-staging-backend `
    --global --project=$ProjectId *> $null
if ($LASTEXITCODE -eq 0) {
    Invoke-Gcloud compute backend-services update lekha-api-staging-backend `
        --global --project=$ProjectId --connection-draining-timeout=60
}

& gcloud compute url-maps describe lekha-api-staging-http-redirect `
    --project=$ProjectId *> $null
$redirectMapExists = $LASTEXITCODE -eq 0
& gcloud compute target-http-proxies describe lekha-api-staging-http-proxy `
    --project=$ProjectId *> $null
if ($redirectMapExists -and $LASTEXITCODE -eq 0) {
    Invoke-Gcloud compute target-http-proxies update lekha-api-staging-http-proxy `
        --project=$ProjectId --url-map=lekha-api-staging-http-redirect
}

# Two smaller API replicas preserve the previous four-vCPU baseline while
# removing the single-instance failure mode. Connection draining on the load
# balancer protects active uploads during later scale-in or rolling updates.
Invoke-Gcloud compute instance-groups managed set-autoscaling $apiGroup `
    --project=$ProjectId --region=$Region --min-num-replicas=2 --max-num-replicas=4 `
    --target-cpu-utilization=0.60 --cool-down-period=900 `
    "--scale-in-control=max-scaled-in-replicas=1,time-window=1800"

# Three warm workers remove the single-worker failure mode. A render normally
# occupies most of a four-vCPU VM, so CPU gives a bounded fallback scale-out signal.
# Automatic scale-in is disabled because Compute Engine cannot prove an RQ job
# has drained; an operator can shrink the group only after pending and started
# registries are empty.
Invoke-Gcloud compute instance-groups managed set-autoscaling $workerGroup `
    --project=$ProjectId --region=$Region --min-num-replicas=3 --max-num-replicas=20 `
    --target-cpu-utilization=0.45 --cool-down-period=180 --mode=only-scale-out

Write-Host "Scaled staging groups configured. Verify every instance and queue before stopping either rollback VM."
