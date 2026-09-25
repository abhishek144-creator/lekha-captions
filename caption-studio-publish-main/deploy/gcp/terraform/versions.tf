terraform {
  required_version = ">= 1.7.0"

  backend "gcs" {
    bucket = "lekha-terraform-state-602676673096"
    prefix = "production/gcp"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project                         = var.project_id
  region                          = var.region
  add_terraform_attribution_label = false
}

provider "google-beta" {
  project                         = var.project_id
  region                          = var.region
  add_terraform_attribution_label = false
}
