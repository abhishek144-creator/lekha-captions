"""Explicit environment-file bootstrap for API and worker entry points."""
import os
import sys
from dotenv import load_dotenv


def load_environment(root_dir):
    runtime_env_file = (os.environ.get("RUNTIME_ENV_FILE") or "").strip()
    if runtime_env_file:
        if not os.path.isabs(runtime_env_file) or not os.path.isfile(runtime_env_file):
            raise RuntimeError("RUNTIME_ENV_FILE must be an existing absolute file")
        load_dotenv(dotenv_path=runtime_env_file, override=False)
    env_local = os.path.join(root_dir, ".env.local")
    env_base = os.path.join(root_dir, ".env")
    _bootstrap_env = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower()
    _bootstrap_is_test = _bootstrap_env in {"test", "testing"} or "pytest" in sys.modules or "unittest" in sys.modules
    if not _bootstrap_is_test or os.environ.get("LOAD_LOCAL_ENV_IN_TESTS") == "1":
        if os.path.exists(env_local):
            load_dotenv(dotenv_path=env_local)
        if os.path.exists(env_base):
            load_dotenv(dotenv_path=env_base)

