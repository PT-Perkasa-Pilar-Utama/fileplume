#!/usr/bin/env python3
"""Verify that a numbered spec set's _index.md matches what is on disk.

Reports three kinds of mismatch and exits non-zero on any of them:
  - entries linked from _index.md that do not exist on disk
  - NN-topic.md files on disk that _index.md never links
  - gaps in the NN numbering sequence

    python scripts/check_index.py --specs-dir docs/technical-specs
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SPEC_FILE_RE = re.compile(r"^(\d{2})-[a-z0-9-]+\.md$")
LINK_RE = re.compile(r"\]\((\d{2}-[a-z0-9-]+\.md)\)")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--specs-dir", default="docs/technical-specs", type=Path)
    parser.add_argument("--index-name", default="_index.md")
    args = parser.parse_args(argv)

    specs_dir: Path = args.specs_dir
    index_path = specs_dir / args.index_name

    if not specs_dir.is_dir():
        print("error: no specs directory at %s" % specs_dir, file=sys.stderr)
        return 2
    if not index_path.is_file():
        print("error: no index at %s" % index_path, file=sys.stderr)
        return 2

    on_disk = sorted(p.name for p in specs_dir.glob("*.md") if SPEC_FILE_RE.match(p.name))
    linked = []
    seen = set()
    for match in LINK_RE.finditer(index_path.read_text(encoding="utf-8")):
        name = match.group(1)
        if name not in seen:
            seen.add(name)
            linked.append(name)

    disk_set, link_set = set(on_disk), set(linked)
    missing = sorted(link_set - disk_set)
    unlinked = sorted(disk_set - link_set)

    numbers = sorted(int(SPEC_FILE_RE.match(n).group(1)) for n in on_disk)
    gaps = []
    if numbers:
        present = set(numbers)
        gaps = [n for n in range(min(numbers), max(numbers) + 1) if n not in present]

    problems = 0

    if missing:
        problems += len(missing)
        print("linked from %s but missing on disk:" % args.index_name)
        for name in missing:
            print("  %s" % name)

    if unlinked:
        problems += len(unlinked)
        print("on disk but not linked from %s:" % args.index_name)
        for name in unlinked:
            print("  %s" % name)

    if gaps:
        problems += len(gaps)
        print("gaps in the NN numbering:")
        for n in gaps:
            print("  %02d missing" % n)

    if problems:
        print("\n%d problem(s) found" % problems, file=sys.stderr)
        return 1

    print("ok: %d spec files, all linked, numbering %02d to %02d with no gaps"
          % (len(on_disk), numbers[0], numbers[-1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
