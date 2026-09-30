# Pay-only-when-used Lekha backend.
#
# Nothing here runs or bills while idle except storage:
#   - API: Cloud Run service, 0..api_max_instances, request-based billing.
#   - Workers: Cloud Run Jobs the API starts only when a queue has work
#     (backend/worker_launcher.py); they exit after worker_idle_exit_seconds.
#   - Redis: pay-per-use TLS provider, REDIS_URL in the runtime secret
#     (docs/SERVERLESS_REDIS_SWITCH.md). No Memorystore, VPC, NAT or load balancer.
#   - Budget: email alerts plus an automatic pause of uploads, transcription
#     and exports when the monthly budget is spent (/api/maintenance/budget-alert).
# Never add always-on VMs, provisioned Redis, NAT or load balancers here without
# the owner's written approval of their idle monthly cost.

locals {
  runtime_secret       = "lekha-runtime-env"
  runtime_env_dir      = "/var/run/lekha-secrets"
  runtime_env_path     = "${local.runtime_env_dir}/runtime.env"
  maintenance_audience = "https://lekha-api.internal/maintenance"

  render_job_name        = "lekha-render"
  gpu_render_job_name    = "lekha-render-gpu"
  transcription_job_name = "lekha-transcription"

  render_queues        = [var.fast_export_queue_name, var.export_queue_name, var.heavy_export_queue_name]
  transcription_queues = [var.media_scan_queue_name, var.transcription_queue_name]

  # Which job the API starts for each queue (WORKER_LAUNCH_JOBS).
  worker_launch_jobs = merge(
    { for queue in local.render_queues : queue => local.render_job_name },
    { for queue in local.transcription_queues : queue => local.transcription_job_name },
    var.enable_gpu_render_job ? { (var.gpu_export_queue_name) = local.gpu_render_job_name } : {},
  )

  # Env set here wins over the runtime secret file (loaded with override=False).
  shared_env = {
    RUNTIME_ENV_FILE         = local.runtime_env_path
    APP_RELEASE              = var.release
    RELEASE_VERSION          = var.release
    GOOGLE_CLOUD_PROJECT     = var.project_id
    RUN_API_BACKGROUND_TASKS = "0"
    # Queue metrics only fed the retired VM autoscalers.
    QUEUE_METRICS_ENABLED = "0"
    # Blank so a stale runtime secret can't point workers at retired VM groups.
    WORKER_MIG_NAME = ""
  }

  worker_env = merge(local.shared_env, {
    WORKER_IDLE_EXIT_SECONDS = tostring(var.worker_idle_exit_seconds)
  })

  # Render workers never scan media (the API and transcription job do). The
  # production boot check needs a scanner setting; with nothing listening
  # here any accidental scan fails closed instead of being skipped.
  render_env = merge(local.worker_env, {
    CLAMAV_HOST = "127.0.0.1"
  })

  required_services = toset([
    "run.googleapis.com",
    "cloudscheduler.googleapis.com",
    "pubsub.googleapis.com",
    "billingbudgets.googleapis.com",
    "secretmanager.googleapis.com",
    "iamcredentials.googleapis.com",
  ])
}

data "google_project" "this" {}

resource "google_project_service" "required" {
  for_each           = local.required_services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# --- Media storage and signed URLs --------------------------------------------

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

# --- Runtime secret (values are added outside Terraform) ----------------------

resource "google_secret_manager_secret_iam_member" "runtime_env_access" {
  project    = var.project_id
  secret_id  = local.runtime_secret
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${var.runtime_service_account}"
  depends_on = [google_project_service.required]
}

# --- API: Cloud Run service, scales to zero -----------------------------------

resource "google_service_account" "scheduler" {
  account_id   = "lekha-cloud-scheduler"
  display_name = "Lekha scheduler and budget caller"
  description  = "Calls the API's maintenance routes from Cloud Scheduler and Pub/Sub"
}

resource "google_cloud_run_v2_service" "api" {
  name                = "lekha-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true

  template {
    service_account                  = var.runtime_service_account
    timeout                          = "300s"
    max_instance_request_concurrency = var.api_concurrency
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"

    scaling {
      # Zero is fixed: an idle API costs nothing.
      min_instance_count = 0
      max_instance_count = var.api_max_instances
    }
    volumes {
      name = "runtime-env"
      secret {
        secret = local.runtime_secret
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
        limits = { cpu = "1", memory = "1Gi" }
        # Request-based billing: CPU and memory are charged only while a request runs.
        cpu_idle          = true
        startup_cpu_boost = true
      }
      volume_mounts {
        name       = "runtime-env"
        mount_path = local.runtime_env_dir
      }
      dynamic "env" {
        for_each = merge(local.shared_env, {
          WEB_CONCURRENCY                 = "1"
          UVICORN_LIMIT_CONCURRENCY       = tostring(var.api_concurrency)
          CLAMAV_HOST                     = "127.0.0.1"
          SCHEDULER_SERVICE_ACCOUNT_EMAIL = google_service_account.scheduler.email
          SCHEDULER_OIDC_AUDIENCE         = local.maintenance_audience
          WORKER_LAUNCH_JOBS              = jsonencode(local.worker_launch_jobs)
          WORKER_LAUNCH_REGION            = var.region
          WORKER_LAUNCH_MAX_PARALLEL      = tostring(var.worker_max_parallel)
          GPU_RENDER_ENABLED              = var.enable_gpu_render_job ? "1" : "0"
          BUDGET_STOP_FRACTION            = tostring(var.budget_stop_fraction)
        })
        content {
          name  = env.key
          value = env.value
        }
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

  depends_on = [google_project_service.required, google_secret_manager_secret_iam_member.runtime_env_access]
}

# The API authenticates its own users; Cloud Run must let browsers reach it.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Workers: Cloud Run Jobs started on demand --------------------------------

resource "google_cloud_run_v2_job" "render" {
  name                = local.render_job_name
  location            = var.region
  deletion_protection = false

  template {
    task_count  = 1
    parallelism = 1
    template {
      service_account       = var.runtime_service_account
      timeout               = "${var.worker_task_timeout_seconds}s"
      max_retries           = 0
      execution_environment = "EXECUTION_ENVIRONMENT_GEN2"
      volumes {
        name = "runtime-env"
        secret {
          secret = local.runtime_secret
          items {
            version = tostring(var.runtime_secret_version)
            path    = "runtime.env"
          }
        }
      }
      containers {
        name  = "render"
        image = var.render_image_uri
        resources {
          limits = { cpu = "4", memory = "12Gi" }
        }
        volume_mounts {
          name       = "runtime-env"
          mount_path = local.runtime_env_dir
        }
        dynamic "env" {
          for_each = merge(local.render_env, {
            WORKER_QUEUES = join(",", local.render_queues)
          })
          content {
            name  = env.key
            value = env.value
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required, google_secret_manager_secret_iam_member.runtime_env_access]
}

resource "google_cloud_run_v2_job" "transcription" {
  name                = local.transcription_job_name
  location            = var.region
  deletion_protection = false

  template {
    task_count  = 1
    parallelism = 1
    template {
      service_account       = var.runtime_service_account
      timeout               = "${var.worker_task_timeout_seconds}s"
      max_retries           = 0
      execution_environment = "EXECUTION_ENVIRONMENT_GEN2"
      volumes {
        name = "runtime-env"
        secret {
          secret = local.runtime_secret
          items {
            version = tostring(var.runtime_secret_version)
            path    = "runtime.env"
          }
        }
      }
      containers {
        name  = "transcription"
        image = var.transcription_image_uri
        resources {
          # clamscan loads its signature database (~1.5 GiB) for each scan.
          limits = { cpu = "2", memory = "4Gi" }
        }
        volume_mounts {
          name       = "runtime-env"
          mount_path = local.runtime_env_dir
        }
        dynamic "env" {
          for_each = merge(local.worker_env, {
            WORKER_QUEUES = join(",", local.transcription_queues)
            # No clamd sidecar in a job (its exit could keep the job billing);
            # scan with the clamscan baked into the transcription image.
            CLAMAV_HOST                 = ""
            CLAMAV_SCAN_CMD             = "clamscan"
            CLAMAV_SCAN_TIMEOUT_SECONDS = "180"
          })
          content {
            name  = env.key
            value = env.value
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required, google_secret_manager_secret_iam_member.runtime_env_access]
}

# Optional L4 GPU lane for heavy animated exports (off by default).
resource "google_cloud_run_v2_job" "render_gpu" {
  count               = var.enable_gpu_render_job ? 1 : 0
  name                = local.gpu_render_job_name
  location            = var.region
  deletion_protection = false
  launch_stage        = "BETA"

  template {
    task_count  = 1
    parallelism = 1
    template {
      service_account               = var.runtime_service_account
      timeout                       = "${var.worker_task_timeout_seconds}s"
      max_retries                   = 0
      execution_environment         = "EXECUTION_ENVIRONMENT_GEN2"
      gpu_zonal_redundancy_disabled = true
      node_selector {
        accelerator = "nvidia-l4"
      }
      volumes {
        name = "runtime-env"
        secret {
          secret = local.runtime_secret
          items {
            version = tostring(var.runtime_secret_version)
            path    = "runtime.env"
          }
        }
      }
      containers {
        name  = "render"
        image = var.render_image_uri
        resources {
          # L4 minimum is 4 CPU / 16 GiB.
          limits = { cpu = "4", memory = "16Gi", "nvidia.com/gpu" = "1" }
        }
        volume_mounts {
          name       = "runtime-env"
          mount_path = local.runtime_env_dir
        }
        dynamic "env" {
          for_each = merge(local.render_env, {
            WORKER_QUEUES        = var.gpu_export_queue_name
            EXPORT_VIDEO_ENCODER = "auto"
          })
          content {
            name  = env.key
            value = env.value
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required, google_secret_manager_secret_iam_member.runtime_env_access]
}

locals {
  launchable_jobs = merge(
    {
      render        = google_cloud_run_v2_job.render.name
      transcription = google_cloud_run_v2_job.transcription.name
    },
    var.enable_gpu_render_job ? { render_gpu = google_cloud_run_v2_job.render_gpu[0].name } : {},
  )
}

# The API starts jobs with a per-run WORKER_LAUNCH_SLOT override.
resource "google_cloud_run_v2_job_iam_member" "api_can_start_workers" {
  for_each = local.launchable_jobs
  project  = var.project_id
  location = var.region
  name     = each.value
  role     = "roles/run.jobsExecutorWithOverrides"
  member   = "serviceAccount:${var.runtime_service_account}"
}

# --- Recovery and maintenance (Cloud Scheduler) --------------------------------
# Normal work is dispatched on the request path; these are safety nets, so they
# run every few minutes instead of every minute. Queue metrics are gone: they
# only fed the retired VM autoscalers.

resource "google_cloud_run_v2_service_iam_member" "scheduler_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

locals {
  maintenance_jobs = {
    transcription-dispatch = "*/5 * * * *"
    media-scan-dispatch    = "*/5 * * * *"
    payment-reconciliation = "*/20 * * * *"
    janitor                = "*/30 * * * *"
  }
}

resource "google_cloud_scheduler_job" "maintenance" {
  for_each         = local.maintenance_jobs
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
    uri         = "${google_cloud_run_v2_service.api.uri}/api/maintenance/${each.key}"
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.maintenance_audience
    }
  }
  depends_on = [google_cloud_run_v2_service_iam_member.scheduler_invoker, google_project_service.required]
}

# --- Budget: email alerts + automatic stop -----------------------------------
# Cloud Billing publishes the budget status to this topic several times a day;
# Pub/Sub pushes it to the API, which pauses uploads, transcription and exports
# once spend reaches budget_stop_fraction. Billing data can lag by hours, so the
# hard caps above (instances, parallel jobs, idle exit, task timeout) are what
# bound the worst case in between.

resource "google_pubsub_topic" "budget" {
  name       = "lekha-budget-alerts"
  depends_on = [google_project_service.required]
}

resource "google_pubsub_subscription" "budget_to_api" {
  name                       = "lekha-budget-alerts-to-api"
  topic                      = google_pubsub_topic.budget.id
  ack_deadline_seconds       = 60
  message_retention_duration = "86400s"

  expiration_policy {
    ttl = ""
  }
  retry_policy {
    minimum_backoff = "30s"
    maximum_backoff = "600s"
  }
  push_config {
    push_endpoint = "${google_cloud_run_v2_service.api.uri}/api/maintenance/budget-alert"
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.maintenance_audience
    }
  }
  depends_on = [google_cloud_run_v2_service_iam_member.scheduler_invoker]
}

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "Lekha monthly budget"

  budget_filter {
    projects        = ["projects/${data.google_project.this.number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency
      units         = tostring(floor(var.monthly_budget))
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.8
  }
  threshold_rules {
    threshold_percent = 1.0
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    pubsub_topic   = google_pubsub_topic.budget.id
    schema_version = "1.0"
    # Keep the default emails to billing admins as well.
    disable_default_iam_recipients = false
  }

  depends_on = [google_project_service.required]
}
