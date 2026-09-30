variable "project_id" {
  type = string
}
variable "region" {
  type    = string
  default = "asia-south1"
}
variable "release" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{40}$", var.release))
    error_message = "release must be a full Git commit SHA"
  }
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
variable "clamav_image_uri" {
  type = string
  # Not a _base tag: _base images carry no signature database, so on Cloud Run
  # (no persistent disk) every cold start would download the full database set
  # from ClamAV's free mirrors before the API could serve, and could get rate-limited.
  description = "ClamAV sidecar image for the API (must include the signature database); production tfvars should pin a reviewed immutable Artifact Registry digest"
  default     = "clamav/clamav:1.4"
}
variable "runtime_secret_version" {
  type        = number
  description = "Numeric version of the lekha-runtime-env secret; never the mutable latest alias"
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

# --- Queues (must match the backend's queue names) ---------------------------
variable "export_queue_name" {
  type    = string
  default = "caption_export_jobs"
}
variable "fast_export_queue_name" {
  type    = string
  default = "caption_export_fast"
}
variable "heavy_export_queue_name" {
  type    = string
  default = "caption_export_heavy"
}
variable "gpu_export_queue_name" {
  type    = string
  default = "caption_export_gpu"
}
variable "transcription_queue_name" {
  type    = string
  default = "caption_transcription_jobs"
}
variable "media_scan_queue_name" {
  type    = string
  default = "caption_media_scan_jobs"
}

# --- Hard caps: the worst case per hour is known before anything runs --------
variable "api_max_instances" {
  type        = number
  description = "Most API instances that can run at once. The API always scales to zero when idle."
  default     = 2

  validation {
    condition     = var.api_max_instances >= 1 && var.api_max_instances <= 4
    error_message = "api_max_instances must stay between 1 and 4."
  }
}
variable "api_concurrency" {
  type    = number
  default = 40
}
variable "worker_max_parallel" {
  type        = number
  description = "Most copies of each worker job that can run at once"
  default     = 1

  validation {
    condition     = var.worker_max_parallel >= 1 && var.worker_max_parallel <= 3
    error_message = "worker_max_parallel must stay between 1 and 3; raise it only with measured cost evidence."
  }
}
variable "worker_idle_exit_seconds" {
  type        = number
  description = "Seconds a worker job waits with empty queues before it exits and stops billing"
  default     = 120

  validation {
    condition     = var.worker_idle_exit_seconds >= 30 && var.worker_idle_exit_seconds <= 900
    error_message = "worker_idle_exit_seconds must be 30-900 so a worker job can never run while idle for long."
  }
}
variable "worker_task_timeout_seconds" {
  type        = number
  description = "Hard limit on one worker job run, even if it is busy or stuck"
  default     = 7200

  validation {
    condition     = var.worker_task_timeout_seconds >= 1800 && var.worker_task_timeout_seconds <= 10800
    error_message = "worker_task_timeout_seconds must be 1800-10800 (30 min to 3 h)."
  }
}
variable "enable_gpu_render_job" {
  type        = bool
  description = "Add an NVIDIA L4 job for heavy animated exports. Keep false until a capped benchmark shows it is worth it; L4 in asia-south1 is invitation-only."
  default     = false
}

# --- Budget: alerts by email and an automatic stop ---------------------------
variable "billing_account_id" {
  type        = string
  description = "Billing account that pays for this project (XXXXXX-XXXXXX-XXXXXX)"

  validation {
    condition     = can(regex("^[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{6}$", var.billing_account_id))
    error_message = "billing_account_id must look like 012345-6789AB-CDEF01."
  }
}
variable "monthly_budget" {
  type        = number
  description = "Monthly spending line, in the billing account's currency"

  validation {
    condition     = var.monthly_budget > 0
    error_message = "monthly_budget must be greater than zero."
  }
}
variable "budget_currency" {
  type        = string
  description = "Must equal the billing account's currency"
  default     = "INR"
}
variable "budget_stop_fraction" {
  type        = number
  description = "Share of the monthly budget at which uploads, transcription and exports pause automatically"
  default     = 1.0

  validation {
    condition     = var.budget_stop_fraction >= 0.5 && var.budget_stop_fraction <= 1.0
    error_message = "budget_stop_fraction must be between 0.5 and 1.0."
  }
}
variable "scheduler_time_zone" {
  type    = string
  default = "Asia/Kolkata"
}
