"""Reject missing, malformed or stale ClamAV database build artifacts.

FreshClam verifies the vendor signature and loads the updated database. This
additional check validates header metadata and age; it is not a signature
verification substitute. Both CVD and incrementally updated CLD are supported.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def metadata(path):
    with path.open('rb') as source:
        fields = source.read(512).decode('ascii').strip().split(':')
    if len(fields) < 9 or fields[0] != 'ClamAV-VDB':
        raise ValueError(f'{path.name}: invalid database header')
    try:
        return {'file':path.name, 'version':int(fields[2]),
                'signatures':int(fields[3]), 'timestamp':int(fields[8])}
    except (ValueError, IndexError) as error:
        raise ValueError(f'{path.name}: invalid database metadata') from error


def verify(directory, *, now=None, max_age_days=7):
    if max_age_days <= 0:
        raise ValueError('Database maximum age must be positive')
    now = datetime.now(timezone.utc).timestamp() if now is None else now
    rows = []
    for name in ('main', 'daily'):
        paths = [directory / (name + suffix) for suffix in ('.cvd', '.cld')]
        existing = [path for path in paths if path.is_file() and path.stat().st_size >= 512]
        if len(existing) != 1:
            raise ValueError(f'{name}: require exactly one nonempty CVD or CLD database')
        row = metadata(existing[0])
        if row['version'] <= 0 or row['signatures'] <= 0 or row['timestamp'] <= 0:
            raise ValueError(f'{name}: invalid database counters')
        age = now - row['timestamp']
        if age < -86400:
            raise ValueError(f'{name}: database timestamp is in the future')
        if name == 'daily' and age > max_age_days * 86400:
            raise ValueError('daily: virus database is older than the accepted maximum age')
        row['age_days'] = round(age / 86400, 3)
        rows.append(row)
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--max-age-days', type=int, default=7)
    args = parser.parse_args()
    try:
        print(json.dumps({'verified':True, 'databases':verify(args.directory, max_age_days=args.max_age_days)}))
    except (OSError, UnicodeError, ValueError) as error:
        parser.exit(1, str(error) + '\n')
