output "redis_host" { value = google_redis_instance.queue.host }
output "redis_port" { value = google_redis_instance.queue.port }
output "api_instance_group" { value = google_compute_region_instance_group_manager.api.instance_group }
output "worker_instance_group" { value = google_compute_region_instance_group_manager.worker.instance_group }
output "cloud_armor_policy" { value = google_compute_security_policy.edge.id }
output "media_bucket" { value = google_storage_bucket.media.url }
output "transcription_instance_group" {
  value = try(google_compute_region_instance_group_manager.transcription[0].instance_group, null)
}
output "spot_worker_instance_group" {
  value = try(google_compute_region_instance_group_manager.spot_worker[0].instance_group, null)
}
output "gpu_worker_instance_group" {
  value = try(google_compute_region_instance_group_manager.gpu_worker[0].instance_group, null)
}
output "cloud_run_api_url" {
  value = try(google_cloud_run_v2_service.api[0].uri, null)
}
output "firebase_hosting_url" { value = google_firebase_hosting_site.editor.default_url }
output "frontend_build_config_secret" {
  value = google_secret_manager_secret.frontend_build_config.secret_id
}
