param(
    [Parameter(Mandatory=$true)][string]$Release,
    [Parameter(Mandatory=$true)][string]$ApiImageUri,
    [Parameter(Mandatory=$true)][string]$RenderImageUri,
    [Parameter(Mandatory=$true)][string]$TranscriptionImageUri,
    [string]$ProjectId = "project-0cc7c839-b9c7-4734-ad0",
    [string]$Region = "asia-south1",
    [string]$Zone = "asia-south1-c"
)

$ErrorActionPreference = "Stop"
if ($Release -notmatch '^[a-f0-9]{40}$') { throw "Release must be a full commit SHA" }
$suffix = $Release.Substring(0, 12)
$builder = "lekha-runtime-bake-$suffix"
$image = "lekha-runtime-$suffix"
$script = Join-Path $PSScriptRoot "bake-runtime-image.sh"
$serviceAccount = "602676673096-compute@developer.gserviceaccount.com"

& gcloud compute instances create $builder `
  --project=$ProjectId --zone=$Zone --machine-type=e2-standard-2 `
  --network=default --subnet=default --no-address `
  --service-account=$serviceAccount --scopes=cloud-platform `
  --boot-disk-size=50GB --boot-disk-type=pd-standard `
  --image-family=debian-12 --image-project=debian-cloud `
  --metadata="region=$Region,api-image-uri=$ApiImageUri,render-image-uri=$RenderImageUri,transcription-image-uri=$TranscriptionImageUri" `
  --metadata-from-file="startup-script=$script" --quiet
if ($LASTEXITCODE -ne 0) { throw "Image builder creation failed" }

$deadline = (Get-Date).AddMinutes(25)
do {
  Start-Sleep -Seconds 15
  $status = (& gcloud compute instances describe $builder --project=$ProjectId --zone=$Zone --format='value(status)').Trim()
  if ($status -eq 'TERMINATED') { break }
} while ((Get-Date) -lt $deadline)
if ($status -ne 'TERMINATED') { throw "Image builder did not finish before the deadline" }

& gcloud compute images create $image --project=$ProjectId `
  --source-disk=$builder --source-disk-zone=$Zone `
  --family=lekha-runtime-stable --storage-location=$Region `
  --labels="app=lekha,release=$suffix,purpose=runtime" --quiet
if ($LASTEXITCODE -ne 0) { throw "Runtime image creation failed" }

& gcloud compute instances delete $builder --project=$ProjectId --zone=$Zone --quiet
if ($LASTEXITCODE -ne 0) { throw "Runtime image built but temporary builder deletion failed" }
Write-Output $image
