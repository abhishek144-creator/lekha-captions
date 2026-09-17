param(
    [string]$ProjectId = "project-0cc7c839-b9c7-4734-ad0",
    [string]$Policy = "lekha-edge-security"
)

$ErrorActionPreference = "Stop"
gcloud compute security-policies describe $Policy --project=$ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute security-policies create $Policy --project=$ProjectId `
        --description="Lekha public edge WAF and upload abuse controls" --type=CLOUD_ARMOR --quiet
}

function Ensure-Rule {
    param([int]$Priority, [string]$Expression, [string]$Action, [string]$Description)
    gcloud compute security-policies rules describe $Priority --security-policy=$Policy --project=$ProjectId *> $null
    if ($LASTEXITCODE -eq 0) { return }
    gcloud compute security-policies rules create $Priority --security-policy=$Policy `
        --project=$ProjectId --expression=$Expression --action=$Action `
        --description=$Description --quiet
    if ($LASTEXITCODE -ne 0) { throw "Unable to create Cloud Armor rule $Priority" }
}

Ensure-Rule 1000 "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})" "deny-403" "Block SQL injection"
Ensure-Rule 1100 "evaluatePreconfiguredWaf('xss-v33-stable', {'sensitivity': 1})" "deny-403" "Block cross-site scripting"
Ensure-Rule 1200 "evaluatePreconfiguredWaf('lfi-v33-stable', {'sensitivity': 1})" "deny-403" "Block local-file inclusion"
Ensure-Rule 1300 "evaluatePreconfiguredWaf('rfi-v33-stable', {'sensitivity': 1})" "deny-403" "Block remote-file inclusion"
Ensure-Rule 1400 "evaluatePreconfiguredWaf('rce-v33-stable', {'sensitivity': 1})" "deny-403" "Block remote-code execution"

foreach ($backend in @("lekha-api-staging-backend", "lekha-frontend-staging-backend")) {
    gcloud compute backend-services update $backend --global --project=$ProjectId `
        --security-policy=$Policy --quiet
    if ($LASTEXITCODE -ne 0) { throw "Unable to attach Cloud Armor to $backend" }
}

Write-Host "Cloud Armor policy $Policy is attached to both public backends."
