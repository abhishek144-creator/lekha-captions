"""Best-effort Compute Engine scale-in protection around an active RQ job."""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request


METADATA_ROOT = "http://metadata.google.internal/computeMetadata/v1"


def _metadata(path):
    request = urllib.request.Request(
        f"{METADATA_ROOT}/{path}", headers={"Metadata-Flavor": "Google"}
    )
    with urllib.request.urlopen(request, timeout=3) as response:  # nosec B310 - fixed metadata host
        return response.read().decode().strip()


class ScaleInProtector:
    def __init__(self):
        self.group = os.environ.get("WORKER_MIG_NAME", "").strip()
        self.region = os.environ.get("WORKER_MIG_REGION", "").strip()
        self.project = os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
        self.instance = ""
        self.zone = ""

    def _discover(self):
        if not self.group or not self.region:
            return False
        self.project = self.project or _metadata("project/project-id")
        self.instance = self.instance or _metadata("instance/name")
        zone_path = _metadata("instance/zone")
        self.zone = self.zone or zone_path.rsplit("/", 1)[-1]
        return bool(self.project and self.instance and self.zone)

    def set(self, protected):
        if not self._discover():
            return False
        token = json.loads(_metadata("instance/service-accounts/default/token"))["access_token"]
        project = urllib.parse.quote(self.project, safe="")
        region = urllib.parse.quote(self.region, safe="")
        group = urllib.parse.quote(self.group, safe="")
        url = (
            f"https://compute.googleapis.com/compute/v1/projects/{project}/regions/{region}"
            f"/instanceGroupManagers/{group}/setInstanceProtection"
        )
        body = json.dumps({
            "instances": [f"zones/{self.zone}/instances/{self.instance}"],
            "protectedFromScaleIn": bool(protected),
        }).encode()
        request = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=8) as response:  # nosec B310 - fixed Google API host
            if response.status not in (200, 201):
                raise RuntimeError(f"Scale-in protection returned HTTP {response.status}")
        return True
