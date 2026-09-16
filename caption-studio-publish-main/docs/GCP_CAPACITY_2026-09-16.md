# Google Cloud export capacity — 16 September 2026

## Live configuration

| Component | Configuration |
|---|---|
| API MIG | Regional, private VMs, `e2-standard-2`, minimum 2, maximum 4, CPU target 60% |
| Worker MIG | Regional, private VMs, `n2-custom-4-12288`, minimum 3, maximum 20 |
| Render allocation | One export consumer per worker, container limit 3 vCPU / 8 GiB |
| Transcription allocation | One helper per worker, container limit 1 vCPU / 2 GiB |
| Worker scaling signals | Export queue depth at one waiting job per desired VM, plus CPU target 45% |
| Scale-in | Disabled until job-aware draining is implemented |
| Pending export limit | 80 waiting jobs |
| Queue lifetime | 600 seconds |
| Capacity response | `Export capacity is temporarily full. Retry after 5 mins.` with `Retry-After: 300` |
| Egress | Cloud NAT; API and worker VMs have no individual public IPs |
| Worker boot disk | 50 GB `pd-standard`, disposable scratch with media cleanup |

The queue limit is admission capacity, not processing capacity. At the maximum
worker count, up to 20 exports render concurrently and up to 80 wait. At the
minimum worker count, three exports render concurrently while the autoscaler
observes the backlog and starts more workers.

## Monitoring

The API publishes these Cloud Monitoring metrics every 30 seconds:

- `custom.googleapis.com/lekha/export_queue_depth`
- `custom.googleapis.com/lekha/export_oldest_job_age_seconds`

Enabled alerts notify the existing owner channel when the queue remains above
15 for five minutes, the oldest job remains above five minutes, or the worker
pool reaches 20 instances. Existing frontend and API availability alerts remain
enabled.

## Quota and disk decisions

The regional in-use-address quota is eight and a request for 30 was denied.
Cloud NAT and private MIG templates remove public addresses from each VM, so
this quota no longer limits worker count.

The regional balanced/SSD disk quota is 500 GB and a request for 1,500 GB was
denied. Worker boot disks therefore use `pd-standard`, whose regional quota is
4,096 GB. Twenty 50-GB worker disks consume 1,000 GB. API disks remain
`pd-balanced` because four API replicas use at most 200 GB.

## Timing evidence

Only four completed export samples were available at deployment time. Their
average end-to-end time was about 43 seconds and P95 about 63 seconds. This is
encouraging but insufficient to claim 100-user performance. A controlled
10/25/50/100 concurrent media test is still required before publishing a mass
user throughput promise.

## Media retention

Temporary render artifacts are deleted immediately where possible. Local
outputs expire after 30 minutes, source uploads after six hours, and the janitor
runs every 15 minutes. Durable exports use plan-based retention of 2, 24, or 72
hours. Worker scratch cleanup runs on each worker independently.
