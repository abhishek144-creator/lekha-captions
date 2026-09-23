locals {
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
    action      = "allow"
    priority    = 2147483647
    description = "default rule"
    preview     = false
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
    origin          = ["https://lekhacaptions.com", "https://www.lekhacaptions.com"]
    method          = ["PUT", "OPTIONS"]
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

resource "google_project_iam_custom_role" "worker_scale_protection" {
  role_id     = "lekhaWorkerScaleProtection"
  title       = "Lekha worker scale-in protection"
  description = "Allows a worker to protect or unprotect itself in the regional MIG while processing a job"
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
    port               = 8000
    port_specification = "USE_FIXED_PORT"
    request_path       = "/api/health/readiness"
  }
}

resource "google_compute_health_check" "worker" {
  name                = "lekha-worker-staging-mig-health"
  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 2
  unhealthy_threshold = 3
  http_health_check {
    port               = 8000
    port_specification = "USE_FIXED_PORT"
    request_path       = "/api/health/readiness"
  }
}

resource "google_compute_instance_template" "api" {
  name         = var.api_instance_template_name
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
  metadata = merge(local.common_metadata, {
    service-role     = "api"
    image-uri        = var.api_image_uri
    "startup-script" = replace(file("${path.module}/../gce-startup.sh"), "\r\n", "\n")
  })
  lifecycle { create_before_destroy = true }
}

resource "google_compute_instance_template" "worker" {
  name         = var.worker_instance_template_name
  machine_type = "n2-custom-4-12288"
  tags         = ["lekha-worker-mig"]
  disk {
    source_image = var.runtime_image
    disk_size_gb = 50
    disk_type    = "pd-standard"
    auto_delete  = true
    boot         = true
  }
  network_interface { network = "default" }
  service_account {
    email  = var.runtime_service_account
    scopes = ["cloud-platform"]
  }
  metadata = merge(local.common_metadata, {
    service-role     = "worker"
    image-uri        = var.render_image_uri
    "startup-script" = replace(file("${path.module}/../gce-startup.sh"), "\r\n", "\n")
  })
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
    type                           = "PROACTIVE"
    minimal_action                 = "REPLACE"
    max_surge_fixed                = 3
    max_unavailable_fixed          = 0
    replacement_method             = "SUBSTITUTE"
    most_disruptive_allowed_action = "REPLACE"
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
    type                           = "PROACTIVE"
    minimal_action                 = "REPLACE"
    max_surge_fixed                = 3
    max_unavailable_fixed          = 0
    replacement_method             = "SUBSTITUTE"
    instance_redistribution_type   = "NONE"
    most_disruptive_allowed_action = "REPLACE"
  }
}

resource "google_compute_region_autoscaler" "api" {
  name   = var.api_autoscaler_name
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
  name   = var.worker_autoscaler_name
  region = var.region
  target = google_compute_region_instance_group_manager.worker.id
  autoscaling_policy {
    min_replicas    = 3
    max_replicas    = 20
    cooldown_period = 180
    cpu_utilization { target = 0.45 }
    metric {
      name                       = "custom.googleapis.com/lekha/export_queue_depth"
      single_instance_assignment = 1
      filter                     = "resource.type = global AND metric.labels.queue = caption_export_jobs AND metric.labels.worker_group = lekha-worker-staging-mig"
    }
    scale_in_control {
      max_scaled_in_replicas {
        fixed = 5
      }
      time_window_sec = 300
    }
  }
}
