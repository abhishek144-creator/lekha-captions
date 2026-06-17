# Pricing Margin Sheet

Date: 2026-06-16

This sheet uses the business assumptions discussed for your current INR pricing.

It is a simple operating model, not GAAP accounting.

## Current pricing in app

| Plan | Monthly | Credits | Max video |
|---|---:|---:|---:|
| Starter | 299 | 15 | 2 min |
| Creator | 499 | 45 | 3 min |
| Pro | 799 | 120 | 3 min |

| Plan | Yearly | Credits | Max video |
|---|---:|---:|---:|
| Starter Yearly | 2500 | 180 | 2 min |
| Creator Yearly | 4500 | 540 | 3 min |
| Pro Yearly | 6500 | 1440 | 3 min |

## Modeling assumptions

- API cost: `INR 0.50 / minute`
- Firebase/storage/export cost: `INR 0.15 / video`
- Replit operating cost: `INR 5 / user / month`
- Replit operating cost for yearly plans: `INR 60 / user / year`
- Razorpay fee: `2.5%`

## Notes on yearly discounts

These are the actual current yearly discounts from the live prices in the app:

- Starter Yearly: about `30.3%` off annualized monthly
- Creator Yearly: about `24.9%` off annualized monthly
- Pro Yearly: about `32.2%` off annualized monthly

## Monthly plan P&L

Average case assumptions:

- Starter average usage: `1 min / credit`
- Creator average usage: `1.5 min / credit`
- Pro average usage: `1.5 min / credit`

Worst case assumptions:

- every credit is used at full allowed video length

### Starter — 299 / 15 credits / 2 min max

| Scenario | API cost | Total cost | Gross profit | Gross margin |
|---|---:|---:|---:|---:|
| Average | 7.50 | 22.23 | 276.77 | 92.6% |
| Worst | 15.00 | 29.73 | 269.27 | 90.1% |

### Creator — 499 / 45 credits / 3 min max

| Scenario | API cost | Total cost | Gross profit | Gross margin |
|---|---:|---:|---:|---:|
| Average | 33.75 | 57.98 | 441.02 | 88.4% |
| Worst | 67.50 | 91.72 | 407.27 | 81.6% |

### Pro — 799 / 120 credits / 3 min max

| Scenario | API cost | Total cost | Gross profit | Gross margin |
|---|---:|---:|---:|---:|
| Average | 90.00 | 132.97 | 666.02 | 83.4% |
| Worst | 180.00 | 222.97 | 576.02 | 72.1% |

## Yearly plan P&L

Average case assumptions:

- Starter average usage: `1 min / credit`
- Creator average usage: `1.5 min / credit`
- Pro average usage: `1.5 min / credit`

### Starter Yearly — 2500 / 180 credits total

| Scenario | Total cost | Gross profit | Gross margin |
|---|---:|---:|---:|
| Average | 239.50 | 2260.50 | 90.4% |
| Worst | 329.50 | 2170.50 | 86.8% |

### Creator Yearly — 4500 / 540 credits total

| Scenario | Total cost | Gross profit | Gross margin |
|---|---:|---:|---:|
| Average | 658.50 | 3841.50 | 85.4% |
| Worst | 1063.50 | 3436.50 | 76.4% |

### Pro Yearly — 6500 / 1440 credits total

| Scenario | Total cost | Gross profit | Gross margin |
|---|---:|---:|---:|
| Average | 1518.50 | 4981.50 | 76.6% |
| Worst | 2598.50 | 3901.50 | 60.0% |

## Margin summary

| Plan | Monthly average | Monthly worst | Yearly average | Yearly worst |
|---|---:|---:|---:|---:|
| Starter | 92.6% | 90.1% | 90.4% | 86.8% |
| Creator | 88.4% | 81.6% | 85.4% | 76.4% |
| Pro | 83.4% | 72.1% | 76.6% | 60.0% |

## Gross vs profit

In this sheet:

- Gross revenue = what the customer pays
- Gross profit = revenue minus API, Firebase, Replit, and Razorpay costs

This is still not final net profit because it does not include:

- salaries
- ads / CAC
- support
- refunds / chargebacks
- tax
- legal / admin overhead

## Revenue at scale

Using this same monthly average-case purchase mix:

- `50%` Starter
- `35%` Creator
- `15%` Pro

Average gross profit per paid user per month:

- `(0.50 × 276.77) + (0.35 × 441.02) + (0.15 × 666.02) = INR 392.65`

| Paying users | Monthly gross profit | Annual gross profit |
|---|---:|---:|
| 100 | 39265 | 471180 |
| 500 | 196325 | 2355900 |
| 1000 | 392650 | 4711800 |
| 2100 | 824565 | 9894780 |
| 5000 | 1963250 | 23559000 |
| 10000 | 3926500 | 47118000 |

## Simple take

- Starter is very strong
- Creator is very strong
- Pro is still healthy even after raising credits to `120`
- Pro Yearly remains the most sensitive plan, but it still holds up under this model

The tradeoff you made is clear:

- more value in Pro
- slightly lower Pro margin
- still healthy enough to scale if usage behaves near your average assumptions
