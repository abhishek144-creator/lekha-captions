"""Optional third-party packages and whether they are installed.

The API still starts without them (payments or error tracking are then
unavailable). Read them as `optional_deps.NAME`, so a test can stand in for
a package in one place.
"""

try:
    import razorpay as _razorpay_module
    RAZORPAY_AVAILABLE = True
except ImportError:
    _razorpay_module = None
    RAZORPAY_AVAILABLE = False
    print("[Warning] razorpay package not installed — payment endpoints will be unavailable")

try:
    import sentry_sdk
    SENTRY_AVAILABLE = True
except ImportError:
    sentry_sdk = None
    SENTRY_AVAILABLE = False
