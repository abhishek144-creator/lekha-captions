# Lekha Google Cloud Terraform

This directory is the source of truth for the API and worker regional MIGs,
autoscaling, Cloud NAT, health checks, Standard HA Redis, the private media
bucket, immutable instance templates, and Cloud Armor policy. Keep secret values outside Terraform; only
the numeric Secret Manager version is supplied.

Existing resources must be imported once before the first plan. Never apply a
plan that proposes replacing Redis or either MIG unexpectedly. Copy
`terraform.tfvars.example` to an ignored `terraform.tfvars`, set immutable image
digests and the release SHA, then run `terraform init`, `terraform import`,
`terraform plan -out=plan.tfplan`, and review the saved plan before apply.

The current production resources can be adopted without recreation with these
one-time imports (run only after filling `terraform.tfvars`):

```powershell
terraform import google_compute_security_policy.edge projects/project-0cc7c839-b9c7-4734-ad0/global/securityPolicies/lekha-edge-security
terraform import google_redis_instance.queue projects/project-0cc7c839-b9c7-4734-ad0/locations/asia-south1/instances/lekha-redis-ha
terraform import google_storage_bucket.media lekha-media-project-0cc7c839-b9c7-4734-ad0
```
