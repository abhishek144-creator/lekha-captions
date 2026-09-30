output "api_uri" {
  description = "Set this as the frontend's API origin"
  value       = google_cloud_run_v2_service.api.uri
}
output "worker_jobs" {
  description = "Cloud Run Jobs the API starts on demand, by queue"
  value       = local.worker_launch_jobs
}
output "media_bucket" { value = google_storage_bucket.media.url }
output "gcs_signing_service_account" {
  description = "Set this email as GCS_SIGNING_SERVICE_ACCOUNT in the runtime Secret Manager version."
  value       = google_service_account.media_url_signer.email
}
output "budget_topic" { value = google_pubsub_topic.budget.id }
