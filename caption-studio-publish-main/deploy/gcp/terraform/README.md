# Lekha Google Cloud Terraform

This directory is the source of truth for the API and worker regional MIGs,
autoscaling, Cloud NAT, health checks, Standard HA Redis, the private media
bucket, immutable instance templates, and Cloud Armor policy. Keep secret values outside Terraform; only
the numeric Secret Manager version is supplied.

Production state is stored in the versioned, public-access-blocked GCS bucket
`gs://lekha-terraform-state-602676673096` under the `production/gcp` prefix.
On 24 September 2026, all 17 existing production resources declared here were
imported into that state. The adoption plan completed with zero additions,
changes, or destroys.

Copy `terraform.tfvars.example` to an ignored `terraform.tfvars`, set the live
immutable image digests, exact resource names, numeric secret version, and
release SHA, then use this workflow:

```powershell
terraform init
terraform validate
terraform plan -input=false -out=plan.tfplan
terraform show -no-color plan.tfplan
```

Review every saved plan before applying it. Stop if Terraform proposes an
unexpected replacement of Redis, an instance template, or either managed
instance group. Do not repeat the imports against the existing remote state.
