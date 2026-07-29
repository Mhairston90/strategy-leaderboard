"""Wait for shared OHLC caches to become healthy before FABLE generation."""
from __future__ import annotations

import argparse
import sys
import time
from collections.abc import Callable

from . import cache_health


def wait_for_cache(
    *,
    check: Callable[[], int],
    sleeper: Callable[[float], None],
    attempts: int,
    interval_seconds: float,
) -> int:
    attempts = max(1, int(attempts))
    interval_seconds = max(0.0, float(interval_seconds))
    for attempt in range(1, attempts + 1):
        try:
            result = int(check())
        except Exception as error:
            result = 1
            print(
                f"[nightly-guard] cache check failed on attempt {attempt}: "
                f"{type(error).__name__}: {error}",
                flush=True,
            )
        if result == 0:
            print(f"[nightly-guard] cache ready on attempt {attempt}", flush=True)
            return 0
        if attempt < attempts:
            print(
                f"[nightly-guard] cache not ready; retry {attempt + 1}/{attempts} "
                f"in {interval_seconds:g}s",
                flush=True,
            )
            sleeper(interval_seconds)
    print(f"[nightly-guard] cache still unhealthy after {attempts} attempts", flush=True)
    return 1


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--attempts", type=int, default=12)
    parser.add_argument("--interval-seconds", type=float, default=60)
    args = parser.parse_args(argv)
    return wait_for_cache(
        check=lambda: cache_health.main(require_ok=True),
        sleeper=time.sleep,
        attempts=args.attempts,
        interval_seconds=args.interval_seconds,
    )


if __name__ == "__main__":
    sys.exit(main())
