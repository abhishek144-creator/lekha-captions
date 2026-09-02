# Mass Launch Runbook

This is the final go/no-go procedure for a public launch. Start from
`docs/RELEASE_RECORD_TEMPLATE.md`. Do not interpret a
successful build as launch approval: every gate below must have current,
redacted evidence attached to the release record.

## 1. Recover and verify DNSSEC

1. In the authoritative DNS provider, identify the active DNSSEC signing key.
2. In the registrar, either publish the DS record generated from that exact key
   or disable DNSSEC at both layers until a new matched key and DS can be
   activated. Never leave a stale DS record at the parent zone.
3. Wait for the parent and resolver caches to expire.
4. Run the synthetic monitor with all customer-facing hosts:

   ```powershell
   $env:SYNTHETIC_BASE_URL = "https://api.lekhacaptions.com"
   $env:SYNTHETIC_DNS_HOSTS = "lekhacaptions.com,app.lekhacaptions.com,api.lekhacaptions.com"
   npm run monitor:synthetic
   ```

5. Require PASS from the Google and Cloudflare validating resolvers and verify
   the same hosts from at least two independent ISP/mobile networks. Keep
   signups, promotion, and payments paused until all checks pass.

## 2. Produce one traceable release

1. Start from one clean commit with green GitHub Actions.
2. Set `VITE_APP_RELEASE`, `APP_RELEASE`, and
   `DEPLOY_VERIFY_EXPECTED_RELEASE` to the same full 40-character commit SHA.
3. Deploy the frontend and backend from that commit; record both provider
   deployment IDs and UTC timestamps.
4. Verify the live artifacts:

   ```powershell
   npm run launch:verify-deployed -- --expected=<40-character-sha>
   ```

5. Save the command output and `/api/health/readiness` response in the release
   evidence. A manual deploy without a commit and provider deployment ID is not
   an acceptable release candidate.

## 3. Exercise real capacity

Run the concurrent media journey only in isolated staging with disposable
accounts and rights-cleared media:

```powershell
python scripts/media_load_smoke.py --base-url https://staging-api.example.com --credentials-json <private-users.json> --video <media.mp4> --jobs 10 --workers 5
```

Increase concurrency in controlled stages until the approved launch target is
reached. Record upload, transcription, rendering, storage, and download p50/p95;
queue depth and oldest-job age; worker CPU/memory; autoscaling events; provider
rate-limit responses; cost per completed job; and recovery after worker/provider
failure. Set documented stop-loss ceilings before the test.

## 4. Browser, accessibility, and customer journey

Run `npm run test:browser` for Chromium, Firefox, WebKit, Android, and iOS
profiles. Save the report. Manually verify keyboard-only and screen-reader use
of signup, login, upload, caption editing, checkout, export, download, account
export, and account deletion. Verify reduced-motion behavior on a real iOS and
Android device.

## 5. Operational approval

The release record must name the on-call primary and backup, rollback owner,
support SLA, approved production concurrency, provider quotas, autoscaling
thresholds, cost ceiling, and tested RTO/RPO. Attach a status-page incident test,
alert-delivery receipts, restore evidence, rollback evidence, and the escalation
roster. Any blank owner or threshold is a launch blocker.

## 6. Professional and security sign-off

Attach an independent penetration-test report or signed remediation statement,
lawyer approval of the public policies/jurisdiction, and CA/tax approval for GST,
invoices, international sales, refunds, and chargebacks. Repository checks cannot
substitute for these professional approvals.

## 7. Public repository decision

Record whether the repository is intentionally public. Before approval, scan the
current tree and full Git history for personal identifiers, secrets, internal
topology, and operational evidence. If public access is not intentional, make the
repository private first. History rewriting and force-pushing require a separate,
reviewed migration with collaborator coordination.

## Final go/no-go

Run `npm run launch:check`, deploy the clean commit, run
`npm run launch:verify-deployed`, and then run the external synthetic journey.
Launch only when every command passes and `docs/COMPLIANCE_CHECKLIST.md` has no
unchecked item backed solely by configuration or an unverified statement.
