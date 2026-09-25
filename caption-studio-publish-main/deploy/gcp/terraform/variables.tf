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
variable "api_instance_template_name" {
  type = string
}
variable "worker_instance_template_name" {
  type = string
}
variable "api_autoscaler_name" {
  type = string
}
variable "worker_autoscaler_name" {
  type = string
}
variable "media_bucket_name" {
  type        = string
  description = "Private bucket used for resumable source uploads and rendered exports"
}

variable "enable_transcription_pool" {
  type    = bool
  default = true
}

variable "enable_spot_burst_pool" {
  type    = bool
  default = true
}

variable "enable_gpu_pool" {
  type        = bool
  default     = false
  description = "Enable only after the controlled NVENC cost benchmark passes"
}

variable "gpu_runtime_image" {
  type        = string
  default     = ""
  description = "Compute Engine boot image with NVIDIA drivers and the NVIDIA Container Toolkit preinstalled"
  validation {
    condition     = !var.enable_gpu_pool || length(trimspace(var.gpu_runtime_image)) > 0
    error_message = "gpu_runtime_image is required when enable_gpu_pool is true"
  }
}

variable "enable_cloud_run_api" {
  type    = bool
  default = true
  validation {
    condition     = !var.enable_cloud_run_api || var.enable_transcription_pool
    error_message = "The Cloud Run API requires the independent transcription pool for its readiness gate."
  }
}

variable "api_cloud_run_service_name" {
  type    = string
  default = "lekha-api"
}

variable "clamav_image_uri" {
  type        = string
  default     = "clamav/clamav:1.4_base"
  description = "ClamAV daemon image used by the Cloud Run API sidecar"
}

variable "api_vpc_network" {
  type        = string
  default     = "default"
  description = "VPC network that hosts the Memorystore Redis instance used by the Cloud Run API"
}

variable "api_vpc_subnetwork" {
  type        = string
  default     = "default"
  description = "Regional subnet used by Cloud Run Direct VPC egress to reach Redis"
}
