output "redis_host" { value = google_redis_instance.queue.host }
output "redis_port" { value = google_redis_instance.queue.port }
output "api_instance_group" { value = google_compute_region_instance_group_manager.api.instance_group }
output "worker_instance_group" { value = google_compute_region_instance_group_manager.worker.instance_group }
output "cloud_armor_policy" { value = google_compute_security_policy.edge.id }
output "media_bucket" { value = google_storage_bucket.media.url }
