import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from cost_reconciliation import (
    BillingEvidence,
    BusinessEvidence,
    CostReconciliationRequest,
    ObservationEvidence,
    ProviderBillingEvidence,
    build_cost_reconciliation,
)


class CostReconciliationTests(unittest.TestCase):
    def test_computes_bill_backed_cost_per_successful_export(self):
        request = CostReconciliationRequest(
            completed=4,
            failed=1,
            rendered_video_minutes=10,
            billing=BillingEvidence(
                source="gcp_detailed_billing_export",
                currency="USD",
                window_start="2026-09-27T00:00:00Z",
                window_end="2026-09-28T00:00:00Z",
                row_count=3,
                net_cost_usd=2.0,
                service_cost_usd={"Compute Engine": 2.0},
                source_sha256="a" * 64,
            ),
            observation_evidence=ObservationEvidence(
                terminal_job_count=5,
                successful_jobs_sha256="b" * 64,
            ),
        )
        result = build_cost_reconciliation("2026-09-27", request)
        self.assertEqual(result["cost_per_successful_export_usd"], 0.5)
        self.assertEqual(result["cost_per_rendered_video_minute_usd"], 0.2)
        self.assertEqual(result["cost_source"], "gcp_detailed_billing_export")

    def test_combines_provider_invoices_and_reports_inr_and_cac(self):
        request = CostReconciliationRequest(
            completed=5,
            failed=0,
            rendered_video_minutes=20,
            billing=BillingEvidence(
                source="gcp_detailed_billing_export",
                currency="USD",
                window_start="2026-09-27T00:00:00Z",
                window_end="2026-09-28T00:00:00Z",
                row_count=2,
                net_cost_usd=3,
                source_sha256="a" * 64,
            ),
            provider_billing=[ProviderBillingEvidence(
                provider="sarvam",
                invoice_id="invoice-1",
                currency="INR",
                original_net_cost=170,
                net_cost_usd=2,
                source_sha256="c" * 64,
            )],
            usd_to_inr_rate=85,
            business_evidence=BusinessEvidence(
                marketing_spend_inr=1000,
                gross_revenue_inr=2500,
                activated_accounts=4,
                source_sha256="d" * 64,
            ),
            observation_evidence=ObservationEvidence(
                terminal_job_count=5,
                successful_jobs_sha256="b" * 64,
            ),
        )
        result = build_cost_reconciliation("2026-09-27", request)
        self.assertEqual(result["actual_net_cost_usd"], 5)
        self.assertEqual(result["provider_net_cost_usd"], 2)
        self.assertEqual(result["cost_per_successful_export_inr"], 85)
        self.assertEqual(result["customer_acquisition_cost_inr"], 250)
        self.assertEqual(result["cost_source"], "gcp_detailed_billing_export+provider_invoices")


if __name__ == "__main__":
    unittest.main()
