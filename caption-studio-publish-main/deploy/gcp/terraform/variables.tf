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
