# Bill-backed export cost accounting

The application records one terminal `export_observation` per export job. Cost
reports reconcile those deduplicated job IDs with the net cost (cost plus
credits) from the Google Cloud detailed billing export for the identical UTC
window. A configured rate-card estimate is never published as actual cost.

For a closed UTC day, export the observations and detailed billing rows:

```powershell
gcloud logging read 'textPayload:"export_observation" AND timestamp>="2026-09-27T00:00:00Z" AND timestamp<"2026-09-28T00:00:00Z"' --project=PROJECT_ID --format=json --limit=100000 | Out-File -Encoding utf8 exports-2026-09-27.json

bq query --project_id=PROJECT_ID --use_legacy_sql=false --format=json 'SELECT usage_start_time, usage_end_time, service, sku, cost, credits, currency FROM `PROJECT_ID.BILLING_DATASET.gcp_billing_export_resource_v1_BILLING_ACCOUNT` WHERE usage_start_time < TIMESTAMP("2026-09-28T00:00:00Z") AND usage_end_time > TIMESTAMP("2026-09-27T00:00:00Z")' | Out-File -Encoding utf8 billing-2026-09-27.json

python scripts/analyze_export_observations.py exports-2026-09-27.json --billing-export billing-2026-09-27.json --provider-invoice sarvam-invoice.json --provider-invoice openai-invoice.json --usd-to-inr-rate 85 --window-start 2026-09-27T00:00:00Z --window-end 2026-09-28T00:00:00Z --output cost-2026-09-27.json
```

Publish the generated report to the admin API. The server recomputes the unit
metrics and stores the billing source, window, row count, and SHA-256 evidence:

Before publishing, attach each OpenAI/Sarvam invoice to `provider_billing` and
record the finance-approved exchange rate. Provider rows retain the original
currency/amount and a normalized USD amount; the evidence digest must be the
SHA-256 of the source invoice export. Optional business evidence enables CAC
and revenue without confusing estimates with ledger-backed values:

```json
{
  "provider_billing": [{
    "provider": "sarvam",
    "invoice_id": "invoice-reference",
    "currency": "INR",
    "original_net_cost": 1700,
    "net_cost_usd": 20,
    "source_sha256": "64-lowercase-hex-characters"
  }],
  "usd_to_inr_rate": 85,
  "business_evidence": {
    "marketing_spend_inr": 10000,
    "gross_revenue_inr": 25000,
    "activated_accounts": 40,
    "source_sha256": "64-lowercase-hex-characters"
  }
}
```

```powershell
curl.exe -X PUT https://api.lekhacaptions.com/api/admin/cost-reconciliations/2026-09-27 -H "Authorization: Bearer ADMIN_FIREBASE_ID_TOKEN" -H "Content-Type: application/json" --data-binary "@cost-2026-09-27.json"
```

`GET /api/analytics/summary?date=YYYY-MM-DD` then returns
`cost_per_successful_export_usd`, `cost_per_successful_export_inr`, provider and
infrastructure subtotals, CAC, revenue, and `actual_net_cost_usd`. The source is
`gcp_detailed_billing_export+provider_invoices` when external provider evidence
is attached. Before a day is reconciled those actual fields stay null and the separately named
`estimated_cost_per_successful_export_usd` remains available for forecasting.
