terraform {
  required_version = ">= 1.7.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  # The Budget API needs a quota project; bill its calls to this project.
  user_project_override = true
  billing_project       = var.project_id
}
