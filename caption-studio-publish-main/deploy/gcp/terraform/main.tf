locals {
  release_short = substr(var.release, 0, 12)
  common_metadata = {
    api-image-uri           = var.api_image_uri
    render-image-uri        = var.render_image_uri
    transcription-image-uri = var.transcription_image_uri
    runtime-secret          = "lekha-runtime-env"
    runtime-secret-version  = tostring(var.runtime_secret_version)
    region                  = var.region
    worker-mig-name         = "lekha-worker-staging-mig"
  }
}

resource "google_compute_security_policy" "edge" {
  name        = "lekha-edge-security"
  description = "Lekha public edge WAF"
  type        = "CLOUD_ARMOR"

  dynamic "rule" {
    for_each = {
      1000 = ["sqli-v33-stable", "SQL injection protection"]
      1100 = ["xss-v33-stable", "Cross-site scripting protection"]
      1200 = ["lfi-v33-stable", "Local file inclusion protection"]
      1300 = ["rfi-v33-stable", "Remote file inclusion protection"]
      1400 = ["rce-v33-stable", "Remote code execution protection"]
    }
    content {
      action      = "deny(403)"
      priority    = tonumber(rule.key)
      description = rule.value[1]
      match {
        expr { expression = "evaluatePreconfiguredWaf('${rule.value[0]}', {'sensitivity': 1})" }
      }
    }
  }
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

resource "google_redis_instance" "queue" {
  name                    = "lekha-redis-ha"
  tier                    = "STANDARD_HA"
  memory_size_gb          = 1
  region                  = var.region
  location_id             = var.zones[2]
  alternative_location_id = var.zones[1]
  redis_version           = "REDIS_7_2"
  authorized_network      = "default"
  connect_mode            = "DIRECT_PEERING"
  redis_configs           = { "maxmemory-policy" = "noeviction" }
}

resource "google_storage_bucket" "media" {
  name                        = var.media_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  cors {
    origin          = var.frontend_origins
    method          = ["PUT", "DELETE", "OPTIONS"]
    response_header = ["Content-Type", "Content-Range", "Range", "X-Goog-Upload-Status"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition { age = 4 }
    action { type = "Delete" }
  }

  lifecycle_rule {
    condition { age = 1 }
    action { type = "AbortIncompleteMultipartUpload" }
  }
}

resource "google_storage_bucket_iam_member" "runtime_media" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.runtime_service_account}"
}

# Object Admin intentionally excludes bucket metadata. The readiness probe calls
# buckets.get before admitting traffic, so grant that narrow permission without
# broadening the runtime identity to full Storage Admin.
resource "google_storage_bucket_iam_member" "runtime_media_bucket_viewer" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.bucketViewer"
  member = "serviceAccount:${var.runtime_service_account}"
}

# The runtime identity delegates URL signing to this narrowly scoped identity.
# It can read media objects for signed downloads but cannot write or delete them.
resource "google_service_account" "media_url_signer" {
  account_id   = "lekha-media-url-signer"
  display_name = "Lekha media URL signer"
  description  = "Signs short-lived URLs for private media downloads"
}

resource "google_storage_bucket_iam_member" "media_url_signer_reader" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.media_url_signer.email}"
  condition {
    title       = "ReadExportObjectsOnly"
    description = "The URL signer may read retained export objects, never source uploads"
    expression  = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.media.name}/objects/exports/')"
  }
}

resource "google_project_iam_custom_role" "media_url_signer_delegate" {
  role_id     = "lekhaMediaUrlSignerDelegate"
  title       = "Lekha media URL signer delegate"
  description = "Allows only blob signing for the dedicated media URL signer"
  permissions = ["iam.serviceAccounts.signBlob"]
}

resource "google_service_account_iam_member" "runtime_can_sign_media_urls" {
  service_account_id = google_service_account.media_url_signer.name
  role               = google_project_iam_custom_role.media_url_signer_delegate.name
  member             = "serviceAccount:${var.runtime_service_account}"
}

resource "google_project_iam_custom_role" "worker_scale_protection" {
  role_id     = "lekhaWorkerScaleProtection"
  title       = "Lekha worker scale-in protection"
  description = "Allows a worker to protect or unprotect itself while processing a job"
  permissions = [
    "compute.instanceGroupManagers.get",
    "compute.instanceGroupManagers.update",
  ]
}

resource "google_project_iam_member" "worker_scale_protection" {
  project = var.project_id
  role    = google_project_iam_custom_role.worker_scale_protection.name
  member  = "serviceAccount:${var.runtime_service_account}"
}

resource "google_compute_router" "egress" {
  name    = "lekha-egress-router"
  region  = var.region
  network = "default"
}

resource "google_compute_router_nat" "egress" {
  name                               = "lekha-egress-nat"
  router                             = google_compute_router.egress.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  min_ports_per_vm                   = 128
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_compute_health_check" "api" {
  name                = "lekha-api-staging-mig-health"
  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 2
  unhealthy_threshold = 3
  http_health_check {
    port         = 8000
    request_path = "/api/health/readiness"
  }
}

resource "google_compute_health_check" "worker" {
  name                = "lekha-worker-staging-mig-health"
  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 2
  unhealthy_threshold = 3
  http_health_check {
    port         = 8000
    request_path = "/api/health/readiness"
  }
}

resource "google_compute_instance_template" "api" {
  name_prefix  = "lekha-api-${local.release_short}-"
  machine_type = "e2-standard-2"
  tags         = ["lekha-api-mig"]
  disk {
    source_image = var.runtime_image
    disk_size_gb = 50
    disk_type    = "pd-balanced"
    auto_delete  = true
    boot         = true
  }
  network_interface { network = "default" }
  service_account {
    email  = var.runtime_service_account
    scopes = ["cloud-platform"]
  }
  metadata                = merge(local.common_metadata, { service-role = "api" })
  metadata_startup_script = file("${path.module}/../gce-startup.sh")
  lifecycle { create_before_destroy = true }
}

resource "google_compute_instance_template" "worker" {
  name_prefix  = "lekha-worker-${local.release_short}-"
  machine_type = var.render_worker_machine_type
  tags         = ["lekha-worker-mig"]
  disk {
    source_image = var.runtime_image
    disk_size_gb = var.render_worker_disk_size_gb
    disk_type    = var.render_worker_disk_type
    auto_delete  = true
    boot         = true
  }
  network_interface { network = "default" }
  service_account {
    email  = var.runtime_service_account
    scopes = ["cloud-platform"]
  }
  metadata = merge(local.common_metadata, {
    service-role            = "render"
    worker-queue-name       = var.export_queue_name
    worker-container-cpus   = "7"
    worker-container-memory = "7g"
  })
  metadata_startup_script = file("${path.module}/../gce-startup.sh")
  lifecycle { create_before_destroy = true }
}

resource "google_compute_instance_template" "transcription" {
  name_prefix  = "lekha-transcription-${local.release_short}-"
  machine_type = "e2-standard-2"
  tags         = ["lekha-worker-mig"]
  disk {
    source_image = var.runtime_image
    disk_size_gb = 30
    disk_type    = "pd-balanced"
    auto_delete  = true
    boot         = true
  }
  network_interface { network = "default" }
  service_account {
    email  = var.runtime_service_account
    scopes = ["cloud-platform"]
  }
  metadata = merge(local.common_metadata, {
    service-role      = "transcription"
    worker-mig-name   = "lekha-transcription-staging-mig"
    worker-queue-name = "${var.media_scan_queue_name},${var.transcription_queue_name}"
  })
  metadata_startup_script = file("${path.module}/../gce-startup.sh")
  lifecycle { create_before_destroy = true }
}

resource "google_compute_region_instance_group_manager" "api" {
  name                      = "lekha-api-staging-mig"
  region                    = var.region
  distribution_policy_zones = var.zones
  base_instance_name        = "lekha-api-staging-mig"
  version { instance_template = google_compute_instance_template.api.id }
  named_port {
    name = "http"
    port = 8000
  }
  auto_healing_policies {
    health_check      = google_compute_health_check.api.id
    initial_delay_sec = 180
  }
  update_policy {
    type                  = "PROACTIVE"
    minimal_action        = "REPLACE"
    max_surge_fixed       = 3
    max_unavailable_fixed = 0
    replacement_method    = "SUBSTITUTE"
  }
}

resource "google_compute_region_instance_group_manager" "worker" {
  name                      = "lekha-worker-staging-mig"
  region                    = var.region
  distribution_policy_zones = var.zones
  # Rendering is a regional batch workload. ANY avoids a prolonged capacity
  # outage when one zone cannot allocate the custom worker machine type; the
  # MIG still spans every configured zone and replaces unhealthy instances.
  distribution_policy_target_shape = "ANY"
  base_instance_name               = "lekha-worker-staging-mig"
  version { instance_template = google_compute_instance_template.worker.id }
  auto_healing_policies {
    health_check      = google_compute_health_check.worker.id
    initial_delay_sec = 180
  }
  update_policy {
    type                         = "PROACTIVE"
    minimal_action               = "REPLACE"
    max_surge_fixed              = 3
    max_unavailable_fixed        = 0
    replacement_method           = "SUBSTITUTE"
    instance_redistribution_type = "NONE"
  }
}

resource "google_compute_region_instance_group_manager" "transcription" {
  name                             = "lekha-transcription-staging-mig"
  region                           = var.region
  distribution_policy_zones        = var.zones
  distribution_policy_target_shape = "ANY"
  base_instance_name               = "lekha-transcription-staging-mig"
  version { instance_template = google_compute_instance_template.transcription.id }
  auto_healing_policies {
    health_check      = google_compute_health_check.worker.id
    initial_delay_sec = 180
  }
  update_policy {
    type                         = "PROACTIVE"
    minimal_action               = "REPLACE"
    max_surge_fixed              = 2
    max_unavailable_fixed        = 0
    replacement_method           = "SUBSTITUTE"
    instance_redistribution_type = "NONE"
  }
}

resource "google_compute_region_autoscaler" "api" {
  name   = "lekha-api-staging-autoscaler"
  region = var.region
  target = google_compute_region_instance_group_manager.api.id
  autoscaling_policy {
    min_replicas    = 2
    max_replicas    = 4
    cooldown_period = 900
    cpu_utilization { target = 0.60 }
    scale_in_control {
      max_scaled_in_replicas {
        fixed = 1
      }
      time_window_sec = 1800
    }
  }
}

resource "google_compute_region_autoscaler" "worker" {
  name   = "lekha-worker-staging-autoscaler"
  region = var.region
  target = google_compute_region_instance_group_manager.worker.id
  autoscaling_policy {
    min_replicas    = var.render_worker_min_replicas
    max_replicas    = var.render_worker_max_replicas
    cooldown_period = 180
    metric {
      name   = "custom.googleapis.com/lekha/export_queue_depth"
      target = 1
      type   = "GAUGE"
      filter = "resource.type = global AND metric.labels.queue = ${var.export_queue_name} AND metric.labels.worker_group = lekha-worker-staging-mig"
    }
    scale_in_control {
      max_scaled_in_replicas {
        fixed = 5
      }
      time_window_sec = 300
    }
  }
}

resource "google_compute_region_autoscaler" "transcription" {
  name   = "lekha-transcription-staging-autoscaler"
  region = var.region
  target = google_compute_region_instance_group_manager.transcription.id
  autoscaling_policy {
    min_replicas    = 0
    max_replicas    = var.transcription_worker_max_replicas
    cooldown_period = 180
    metric {
      name   = "custom.googleapis.com/lekha/transcription_queue_depth"
      target = 1
      type   = "GAUGE"
      filter = "resource.type = global AND metric.labels.queue = ${var.transcription_queue_name} AND metric.labels.worker_group = lekha-transcription-staging-mig"
    }
    scale_in_control {
      max_scaled_in_replicas {
        fixed = 2
      }
      time_window_sec = 300
    }
  }
}

# Spot workers consume the same idempotent render queue as the baseline pool.
# They have no minimum, so interruption-prone capacity is used only for bursts.
resource "google_compute_instance_template" "worker_spot" {
  count        = var.spot_render_worker_max_replicas > 0 ? 1 : 0
  name_prefix  = "lekha-worker-spot-${local.release_short}-"
  machine_type = var.render_worker_machine_type
  tags         = ["lekha-worker-mig"]
  disk {
    source_image = var.runtime_image
    disk_size_gb = var.render_worker_disk_size_gb
    disk_type    = var.render_worker_disk_type
    auto_delete  = true
    boot         = true
  }
  network_interface { network = "default" }
  scheduling {
    provisioning_model          = "SPOT"
    automatic_restart           = false
    on_host_maintenance         = "TERMINATE"
    instance_termination_action = "DELETE"
  }
  service_account {
    email  = var.runtime_service_account
    scopes = ["cloud-platform"]
  }
  metadata = merge(local.common_metadata, {
    service-role            = "render"
    worker-mig-name         = "lekha-worker-spot-staging-mig"
    worker-queue-name       = var.export_queue_name
    worker-container-cpus   = "7"
    worker-container-memory = "7g"
  })
  metadata_startup_script = file("${path.module}/../gce-startup.sh")
  lifecycle { create_before_destroy = true }
}

resource "google_compute_region_instance_group_manager" "worker_spot" {
  count                            = var.spot_render_worker_max_replicas > 0 ? 1 : 0
  name                             = "lekha-worker-spot-staging-mig"
  region                           = var.region
  distribution_policy_zones        = var.zones
  distribution_policy_target_shape = "ANY"
  base_instance_name               = "lekha-worker-spot"
  version { instance_template = google_compute_instance_template.worker_spot[0].id }
  auto_healing_policies {
    health_check      = google_compute_health_check.worker.id
    initial_delay_sec = 180
  }
  update_policy {
    type                         = "PROACTIVE"
    minimal_action               = "REPLACE"
    max_surge_fixed              = 2
    max_unavailable_fixed        = 0
    replacement_method           = "SUBSTITUTE"
    instance_redistribution_type = "NONE"
  }
}

resource "google_compute_region_autoscaler" "worker_spot" {
  count  = var.spot_render_worker_max_replicas > 0 ? 1 : 0
  name   = "lekha-worker-spot-staging-autoscaler"
  region = var.region
  target = google_compute_region_instance_group_manager.worker_spot[0].id
  autoscaling_policy {
    min_replicas    = 0
    max_replicas    = var.spot_render_worker_max_replicas
    cooldown_period = 180
    metric {
      name   = "custom.googleapis.com/lekha/export_queue_depth"
      target = 2
      type   = "GAUGE"
      # Both pools deliberately observe the same queue-depth series. The Spot
      # pool's higher target makes it overflow capacity after the baseline pool.
      filter = "resource.type = global AND metric.labels.queue = ${var.export_queue_name} AND metric.labels.worker_group = lekha-worker-staging-mig"
    }
    scale_in_control {
      max_scaled_in_replicas { fixed = 2 }
      time_window_sec = 300
    }
  }
}

# Cloud Run is created in parallel with the API MIG. Its serverless NEG is the
# explicit hand-off point for a measured load-balancer cutover; Terraform never
# silently moves production traffic merely because this candidate is enabled.
resource "google_vpc_access_connector" "api" {
  count         = var.enable_cloud_run_api ? 1 : 0
  name          = "lekha-api-connector"
  region        = var.region
  network       = "default"
  ip_cidr_range = var.cloud_run_vpc_connector_cidr
  min_instances = 2
  max_instances = 3
}

resource "google_service_account" "scheduler" {
  count        = var.enable_cloud_run_api ? 1 : 0
  account_id   = "lekha-cloud-scheduler"
  display_name = "Lekha Cloud Scheduler caller"
}

resource "google_secret_manager_secret_iam_member" "runtime_env_access" {
  count     = var.enable_cloud_run_api ? 1 : 0
  project   = var.project_id
  secret_id = "lekha-runtime-env"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.runtime_service_account}"
}

resource "google_cloud_run_v2_service" "api" {
  count               = var.enable_cloud_run_api ? 1 : 0
  name                = "lekha-api-staging"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  deletion_protection = true

  template {
    service_account                  = var.runtime_service_account
    timeout                          = "300s"
    max_instance_request_concurrency = var.cloud_run_api_concurrency
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"

    scaling {
      min_instance_count = var.cloud_run_api_min_instances
      max_instance_count = var.cloud_run_api_max_instances
    }
    vpc_access {
      connector = google_vpc_access_connector.api[0].id
      egress    = "PRIVATE_RANGES_ONLY"
    }
    volumes {
      name = "runtime-env"
      secret {
        secret = "lekha-runtime-env"
        items {
          version = tostring(var.runtime_secret_version)
          path    = "runtime.env"
        }
      }
    }
    containers {
      name       = "api"
      depends_on = ["clamav"]
      image      = var.api_image_uri
      ports { container_port = 8000 }
      resources {
        limits            = { cpu = "1", memory = "1Gi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      volume_mounts {
        name       = "runtime-env"
        mount_path = "/var/run/lekha-secrets"
      }
      env {
        name  = "RUNTIME_ENV_FILE"
        value = "/var/run/lekha-secrets/runtime.env"
      }
      env {
        name  = "RUN_API_BACKGROUND_TASKS"
        value = "0"
      }
      env {
        name  = "WEB_CONCURRENCY"
        value = "1"
      }
      env {
        name  = "UVICORN_LIMIT_CONCURRENCY"
        value = tostring(var.cloud_run_api_concurrency)
      }
      env {
        name  = "APP_RELEASE"
        value = var.release
      }
      env {
        name  = "RELEASE_VERSION"
        value = var.release
      }
      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.queue.host}:${google_redis_instance.queue.port}/0"
      }
      env {
        name  = "CLAMAV_HOST"
        value = "127.0.0.1"
      }
      env {
        name  = "SCHEDULER_SERVICE_ACCOUNT_EMAIL"
        value = google_service_account.scheduler[0].email
      }
      env {
        name  = "SCHEDULER_OIDC_AUDIENCE"
        value = "https://lekha-api.internal/maintenance"
      }
      startup_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 18
        http_get { path = "/api/health/readiness" }
      }
      liveness_probe {
        timeout_seconds   = 5
        period_seconds    = 30
        failure_threshold = 3
        http_get { path = "/api/health" }
      }
    }
    containers {
      name  = "clamav"
      image = var.clamav_image_uri
      resources {
        limits            = { cpu = "1", memory = "2Gi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      startup_probe {
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 30
        tcp_socket { port = 3310 }
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.runtime_env_access]
}

resource "google_cloud_run_v2_service_iam_member" "public_via_load_balancer" {
  count    = var.enable_cloud_run_api ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "scheduler_invoker" {
  count    = var.enable_cloud_run_api ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler[0].email}"
}

resource "google_compute_region_network_endpoint_group" "api_cloud_run" {
  count                 = var.enable_cloud_run_api ? 1 : 0
  name                  = "lekha-api-cloud-run-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run { service = google_cloud_run_v2_service.api[0].name }
}

locals {
  maintenance_jobs = {
    transcription-dispatch = "*/1 * * * *"
    media-scan-dispatch    = "*/1 * * * *"
    queue-metrics          = "*/1 * * * *"
    janitor                = "*/15 * * * *"
    payment-reconciliation = "*/20 * * * *"
  }
}

resource "google_cloud_scheduler_job" "maintenance" {
  for_each         = var.enable_cloud_run_api ? local.maintenance_jobs : {}
  name             = "lekha-${each.key}"
  region           = var.region
  schedule         = each.value
  time_zone        = var.scheduler_time_zone
  attempt_deadline = "300s"
  retry_config {
    retry_count          = 3
    min_backoff_duration = "5s"
    max_backoff_duration = "60s"
  }
  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api[0].uri}/api/maintenance/${each.key}"
    oidc_token {
      service_account_email = google_service_account.scheduler[0].email
      audience              = "https://lekha-api.internal/maintenance"
    }
  }
  depends_on = [google_cloud_run_v2_service_iam_member.scheduler_invoker]
}
