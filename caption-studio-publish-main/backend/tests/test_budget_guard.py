import unittest

from backend.services.budget_guard import budget_exhausted


class BudgetGuardTests(unittest.TestCase):
    def test_stops_only_when_actual_spend_reaches_the_line(self):
        self.assertFalse(budget_exhausted({"costAmount": 999.99, "budgetAmount": 1000}))
        self.assertTrue(budget_exhausted({"costAmount": 1000, "budgetAmount": 1000}))
        self.assertTrue(budget_exhausted({"costAmount": 800, "budgetAmount": 1000}, stop_fraction=0.8))

    def test_forecasts_and_malformed_payloads_never_stop_the_service(self):
        self.assertFalse(budget_exhausted({"costAmount": 10, "budgetAmount": 1000, "forecastThresholdExceeded": 1.0}))
        for payload in ({}, {"costAmount": "x", "budgetAmount": 1000}, {"costAmount": 5, "budgetAmount": 0}, None):
            self.assertFalse(budget_exhausted(payload))
