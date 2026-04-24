import argparse
import concurrent.futures
import time
import requests


def hit(base_url: str, path: str) -> tuple[str, int, float]:
    t0 = time.time()
    try:
        r = requests.get(f"{base_url.rstrip('/')}{path}", timeout=8)
        return path, r.status_code, (time.time() - t0) * 1000
    except Exception:
        return path, 0, (time.time() - t0) * 1000


def main():
    parser = argparse.ArgumentParser(description="Load smoke test for readiness endpoints.")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--workers", type=int, default=20)
    args = parser.parse_args()

    paths = ["/api/version", "/api/analytics/summary", "/api/slo/status", "/api/health/readiness"]
    statuses = {}
    latencies = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [
            ex.submit(hit, args.base_url, paths[i % len(paths)])
            for i in range(max(1, args.requests))
        ]
        for f in concurrent.futures.as_completed(futures):
            path, status, ms = f.result()
            statuses[(path, status)] = statuses.get((path, status), 0) + 1
            latencies.append(ms)

    latencies.sort()
    p95 = latencies[max(0, int(0.95 * len(latencies)) - 1)] if latencies else 0
    print("Smoke summary:")
    print(f"  total={len(latencies)} p95_ms={p95:.1f}")
    for (path, status), count in sorted(statuses.items(), key=lambda x: (x[0][0], x[0][1])):
        print(f"  {path} status={status} count={count}")

    if any(status == 0 or status >= 500 for (_, status), _ in statuses.items()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
