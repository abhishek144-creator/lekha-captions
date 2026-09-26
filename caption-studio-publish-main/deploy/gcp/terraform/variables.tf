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
  default     = 20
}
variable "render_worker_min_replicas" {
  type        = number
  description = "Minimum on-demand render workers"
  default     = 3
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
  description = "Interruptible overflow capacity; zero disables the Spot MIG"
  default     = 5
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
  default     = 4
}
variable "transcription_worker_max_replicas" {
  type        = number
  description = "Maximum independently queue-driven transcription worker count"
  default     = 10
}
variable "enable_cloud_run_api" {
  type        = bool
  description = "Create the parallel Cloud Run API candidate and scheduler jobs; traffic cutover remains an explicit load-balancer operation"
  default     = true
}
variable "cloud_run_api_min_instances" {
  type    = number
  default = 0
}
variable "cloud_run_api_max_instances" {
  type    = number
  default = 20
}
variable "cloud_run_api_concurrency" {
  type    = number
  default = 40
}
variable "cloud_run_vpc_connector_cidr" {
  type        = string
  description = "Unused /28 used by the Serverless VPC Access connector"
  default     = "10.8.0.0/28"
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
