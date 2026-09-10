#!/usr/bin/env python3
"""Verify every AC cited by a task breakdown exists in the business docs.

A card citing a fabricated or stale AC id is a card whose Definition of Done
cannot be met, and nothing else in the pipeline catches it.

Reports two kinds of problem:
  - cited ids that no business document defines (fails, exit 1)
  - defined ids that no card cites (reported, does not fail unless --strict)

    python scripts/check_ac_refs.py docs/TASK_BREAKDOWN.md --business-dir docs/business
    python scripts/check_ac_refs.py docs/TASK_BREAKDOWN.md --strict
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

AC_RE = re.compile(r"AC-\d{2}\.\d{2}")
CARD_ID_RE = re.compile(r"^(BE|FE|TL|DB)-S\d+-\d+$")


def parse_row(line: str) -> list[str] | None:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return None
    cells = [c.strip() for c in stripped[1:-1].split("|")]
    return cells if len(cells) >= 6 else None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("board", type=Path, nargs="?", default=Path("docs/TASK_BREAKDOWN.md"))
    parser.add_argument("--business-dir", default=Path("docs/business"), type=Path)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="also fail when a defined AC is cited by no card",
    )
    args = parser.parse_args(argv)

    if not args.board.is_file():
        print(f"error: {args.board} not found", file=sys.stderr)
        return 2
    if not args.business_dir.is_dir():
        print(f"error: {args.business_dir} not found", file=sys.stderr)
        return 2

    defined: set[str] = set()
    for path in sorted(args.business_dir.rglob("*.md")):
        defined.update(AC_RE.findall(path.read_text(encoding="utf-8")))

    if not defined:
        print(f"error: no AC ids found under {args.business_dir}", file=sys.stderr)
        return 2

    cited: dict[str, list[str]] = defaultdict(list)
    for line in args.board.read_text(encoding="utf-8").splitlines():
        cells = parse_row(line)
        if not cells or not CARD_ID_RE.match(cells[0]):
            continue
        for ac in AC_RE.findall(cells[3]):
            cited[ac].append(cells[0])

    unknown = sorted(set(cited) - defined)
    uncited = sorted(defined - set(cited))

    for ac in unknown:
        print(
            f"error: {ac} cited by {', '.join(cited[ac])} but defined nowhere in "
            f"{args.business_dir}",
            file=sys.stderr,
        )
    for ac in uncited:
        print(f"warn: {ac} is defined but no card cites it", file=sys.stderr)

    print(
        f"{len(defined)} AC defined, {len(cited)} cited by cards, "
        f"{len(unknown)} unknown, {len(uncited)} uncited"
    )

    if unknown:
        print("fix the card, or add the missing AC via /grooming", file=sys.stderr)
        return 1
    if uncited and args.strict:
        return 1
    print("ok: every cited AC exists in the business docs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
