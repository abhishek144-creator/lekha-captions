output "redis_host" { value = google_redis_instance.queue.host }
output "redis_port" { value = google_redis_instance.queue.port }
output "api_instance_group" { value = google_compute_region_instance_group_manager.api.instance_group }
output "worker_instance_group" { value = google_compute_region_instance_group_manager.worker.instance_group }
output "transcription_instance_group" { value = google_compute_region_instance_group_manager.transcription.instance_group }
output "spot_worker_instance_group" {
  value = try(google_compute_region_instance_group_manager.worker_spot[0].instance_group, null)
}
output "gpu_worker_instance_group" {
  description = "Optional G2/L4 render worker group; null while disabled"
  value       = try(google_compute_region_instance_group_manager.worker_gpu[0].instance_group, null)
}
output "cloud_run_api_uri" {
  description = "Parallel API candidate URI; null until enable_cloud_run_api is true"
  value       = try(google_cloud_run_v2_service.api[0].uri, null)
}
output "cloud_run_api_serverless_neg" {
  description = "Attach this NEG to the existing HTTPS load balancer only after acceptance testing"
  value       = try(google_compute_region_network_endpoint_group.api_cloud_run[0].id, null)
}
output "cloud_armor_policy" { value = google_compute_security_policy.edge.id }
output "media_bucket" { value = google_storage_bucket.media.url }
output "gcs_signing_service_account" {
  description = "Set this email as GCS_SIGNING_SERVICE_ACCOUNT in the runtime Secret Manager version."
  value       = google_service_account.media_url_signer.email
}
