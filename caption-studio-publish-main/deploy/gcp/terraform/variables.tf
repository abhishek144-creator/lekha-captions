variable "project_id" {
  type = string
}
variable "region" {
  type    = string
  default = "asia-south1"
}
variable "zones" {
  type    = list(string)
  default = ["asia-south1-a", "asia-south1-b", "asia-south1-c"]
}
variable "release" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{40}$", var.release))
    error_message = "release must be a full Git commit SHA"
  }
}
variable "runtime_image" {
  type = string
}
variable "api_image_uri" {
  type = string
}
variable "render_image_uri" {
  type = string
}
variable "transcription_image_uri" {
  type = string
}
variable "runtime_secret_version" {
  type = number
}
variable "runtime_service_account" {
  type = string
}
variable "media_bucket_name" {
  type        = string
  description = "Private bucket used for resumable source uploads and rendered exports"
}
variable "frontend_origins" {
  type        = list(string)
  description = "Explicit browser origins allowed to create and cancel direct uploads"
  default = [
    "https://lekhacaptions.com",
    "https://www.lekhacaptions.com",
    "https://app.lekhacaptions.com",
  ]
  validation {
    condition = length(var.frontend_origins) > 0 && alltrue([
      for origin in var.frontend_origins : can(regex("^https://[^/]+$", origin))
    ])
    error_message = "frontend_origins must contain explicit HTTPS origins without paths or wildcards"
  }
}
variable "export_queue_name" {
  type        = string
  description = "RQ queue consumed only by heavyweight render workers"
  default     = "caption_export_jobs"
}
variable "fast_export_queue_name" {
  type        = string
  description = "Priority RQ queue for short render work"
  default     = "caption_export_fast"
}
variable "heavy_export_queue_name" {
  type        = string
  description = "RQ queue for long render work and Spot overflow"
  default     = "caption_export_heavy"
}
variable "gpu_export_queue_name" {
  type        = string
  description = "RQ queue used only when the optional G2/L4 pool is enabled"
  default     = "caption_export_gpu"
}
variable "transcription_queue_name" {
  type        = string
  description = "RQ queue consumed only by the independently scaled transcription pool"
  default     = "caption_transcription_jobs"
}
variable "media_scan_queue_name" {
  type        = string
  description = "RQ queue for eager post-upload malware scans, consumed by the transcription pool"
  default     = "caption_media_scan_jobs"
}
variable "render_worker_max_replicas" {
  type        = number
  description = "Maximum queue-driven render worker count"
  default     = 3

  validation {
    condition     = var.render_worker_max_replicas >= 1 && var.render_worker_max_replicas <= 3
    error_message = "render_worker_max_replicas must stay between 1 and 3; raise this guardrail only with measured load-test and cost evidence."
  }
}
variable "api_legacy_target_size" {
  type        = number
  description = "Temporary rollback API capacity during an explicitly monitored Cloud Run canary; zero is the normal production value"
  default     = 0

  validation {
    condition     = var.api_legacy_target_size >= 0 && var.api_legacy_target_size <= 2 && floor(var.api_legacy_target_size) == var.api_legacy_target_size
    error_message = "api_legacy_target_size must be an integer from 0 to 2 and should remain zero outside a monitored rollback window."
  }
}
variable "render_worker_min_replicas" {
  type        = number
  description = "Minimum on-demand render workers; production must scale to zero while queues are empty"
  default     = 0

  validation {
    condition     = var.render_worker_min_replicas == 0
    error_message = "render_worker_min_replicas must be zero so idle render VMs are not billed."
  }
}
variable "render_worker_machine_type" {
  type        = string
  description = "Benchmark-backed production render worker shape"
  default     = "n2-custom-4-12288"
}
variable "render_worker_disk_size_gb" {
  type        = number
  description = "SSD boot/scratch capacity for concurrent source, frame, and output files"
  default     = 100
}
variable "render_worker_disk_type" {
  type        = string
  description = "Persistent disk type for render workers"
  default     = "pd-ssd"
}
variable "spot_render_worker_max_replicas" {
  type        = number
  description = "Bounded interruptible overflow capacity for the retry-safe heavy-render queue"
  default     = 1

  validation {
    condition     = var.spot_render_worker_max_replicas >= 0 && var.spot_render_worker_max_replicas <= 2
    error_message = "spot_render_worker_max_replicas must stay between 0 and 2."
  }
}
variable "enable_gpu_pool" {
  type        = bool
  description = "Create an optional G2/L4 render pool; keep false until a matched cost and visual-parity benchmark passes"
  default     = false
}
variable "gpu_runtime_image" {
  type        = string
  description = "GPU-driver-enabled Compute Engine image used by the optional G2/L4 pool"
  default     = ""
}
variable "gpu_render_worker_max_replicas" {
  type        = number
  description = "Maximum optional G2/L4 workers"
  default     = 1

  validation {
    condition     = var.gpu_render_worker_max_replicas >= 0 && var.gpu_render_worker_max_replicas <= 1
    error_message = "gpu_render_worker_max_replicas must stay between 0 and 1."
  }
}
variable "transcription_worker_max_replicas" {
  type        = number
  description = "Maximum independently queue-driven transcription worker count"
  default     = 2

  validation {
    condition     = var.transcription_worker_max_replicas >= 1 && var.transcription_worker_max_replicas <= 2
    error_message = "transcription_worker_max_replicas must stay between 1 and 2."
  }
}
variable "enable_cloud_run_api" {
  type        = bool
  description = "Create the parallel Cloud Run API candidate and scheduler jobs; traffic cutover remains an explicit load-balancer operation"
  default     = true
}
variable "cloud_run_api_min_instances" {
  type    = number
  default = 0

  validation {
    condition     = var.cloud_run_api_min_instances == 0
    error_message = "cloud_run_api_min_instances must be zero so an idle API has no instance charge."
  }
}
variable "cloud_run_api_max_instances" {
  type    = number
  default = 4

  validation {
    condition     = var.cloud_run_api_max_instances >= 1 && var.cloud_run_api_max_instances <= 4
    error_message = "cloud_run_api_max_instances must stay between 1 and 4."
  }
}
variable "cloud_run_api_concurrency" {
  type    = number
  default = 40
}
variable "cloud_run_vpc_network" {
  type        = string
  description = "VPC network used by Cloud Run Direct VPC egress"
  default     = "default"
}
variable "cloud_run_vpc_subnetwork" {
  type        = string
  description = "Regional subnetwork used by Cloud Run Direct VPC egress"
  default     = "default"
}
variable "clamav_image_uri" {
  type        = string
  description = "ClamAV sidecar image; production tfvars should replace this tag with a reviewed immutable Artifact Registry digest"
  default     = "clamav/clamav:1.4_base"
}
variable "scheduler_time_zone" {
  type    = string
  default = "Asia/Kolkata"
}
