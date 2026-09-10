#!/usr/bin/env python3
"""Recompute the Summary table in a task breakdown from its card tables.

Counts cards and sums estimates per role per sprint, then rewrites the
`## Summary` section in place. Hand-counting a board that changes every
sprint is how a summary quietly stops matching its own cards.

Also validates Card IDs and exits non-zero on any of:
  - a duplicate Card ID
  - a non-sequential NN within a role and sprint
  - a Card ID whose sprint number disagrees with its section heading
  - an Est that is not a number

    python scripts/recompute_summary.py docs/TASK_BREAKDOWN.md
    python scripts/recompute_summary.py docs/TASK_BREAKDOWN.md --write
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

CARD_ID_RE = re.compile(r"^(BE|FE|TL|DB)-S(\d+)-(\d+)$")
SPRINT_HEADING_RE = re.compile(r"^## Sprint (\d+):\s*(.+?)\s*$")
SUMMARY_HEADING_RE = re.compile(r"^## Summary\s*$")
NEXT_H2_RE = re.compile(r"^## ")
ROLES = ("TL", "BE", "FE", "DB")


def parse_row(line: str) -> list[str] | None:
    """Split a markdown table row into cells, or None if it is not one."""
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return None
    cells = [c.strip() for c in stripped[1:-1].split("|")]
    return cells if len(cells) >= 6 else None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("board", type=Path, nargs="?", default=Path("docs/TASK_BREAKDOWN.md"))
    parser.add_argument("--write", action="store_true", help="rewrite the Summary section in place")
    args = parser.parse_args(argv)

    if not args.board.is_file():
        print(f"error: {args.board} not found", file=sys.stderr)
        return 2

    lines = args.board.read_text(encoding="utf-8").splitlines()

    warnings: list[str] = []
    seen_ids: dict[str, int] = {}
    tally: dict[int, dict[str, list[float]]] = defaultdict(
        lambda: {r: [0, 0.0] for r in ROLES}
    )
    focus: dict[int, str] = {}
    last_nn: dict[tuple[str, int], int] = {}

    current_sprint: int | None = None
    in_summary = False

    for lineno, line in enumerate(lines, 1):
        heading = SPRINT_HEADING_RE.match(line)
        if heading:
            current_sprint = int(heading.group(1))
            focus[current_sprint] = heading.group(2)
            in_summary = False
            continue
        if SUMMARY_HEADING_RE.match(line):
            in_summary = True
            continue
        if NEXT_H2_RE.match(line):
            in_summary = False
        if in_summary:
            continue

        cells = parse_row(line)
        if not cells:
            continue
        match = CARD_ID_RE.match(cells[0])
        if not match:
            continue

        role, sprint_str, nn_str = match.groups()
        sprint, nn = int(sprint_str), int(nn_str)

        if cells[0] in seen_ids:
            warnings.append(
                f"line {lineno}: duplicate Card ID {cells[0]} (first seen line {seen_ids[cells[0]]})"
            )
        else:
            seen_ids[cells[0]] = lineno

        if current_sprint is not None and sprint != current_sprint:
            warnings.append(
                f"line {lineno}: {cells[0]} sits under 'Sprint {current_sprint}' "
                f"but its id says sprint {sprint}"
            )

        expected = last_nn.get((role, sprint), 0) + 1
        if nn != expected:
            warnings.append(
                f"line {lineno}: {cells[0]} breaks the sequence, "
                f"expected {role}-S{sprint}-{expected:02d}"
            )
        last_nn[(role, sprint)] = nn

        est_cell = cells[5]
        try:
            est = float(est_cell)
        except ValueError:
            warnings.append(f"line {lineno}: {cells[0]} has a non-numeric Est {est_cell!r}")
            est = 0.0

        tally[sprint][role][0] += 1
        tally[sprint][role][1] += est

    if not tally:
        print("error: no card rows found; is this a task breakdown?", file=sys.stderr)
        return 2

    used_roles = [r for r in ROLES if any(tally[s][r][0] for s in tally)]
    header = (
        "| Sprint | Focus | "
        + " | ".join(f"{r} cards" for r in used_roles)
        + " | "
        + " | ".join(f"{r} Est" for r in used_roles)
        + " |"
    )
    rule = "|---|---|" + "---|" * (len(used_roles) * 2)

    def fmt(value: float) -> str:
        return str(int(value)) if value == int(value) else str(value)

    body = []
    totals = {r: [0, 0.0] for r in used_roles}
    for sprint in sorted(tally):
        counts = [tally[sprint][r][0] for r in used_roles]
        ests = [tally[sprint][r][1] for r in used_roles]
        for r in used_roles:
            totals[r][0] += tally[sprint][r][0]
            totals[r][1] += tally[sprint][r][1]
        body.append(
            f"| {sprint} | {focus.get(sprint, '')} | "
            + " | ".join(str(c) for c in counts)
            + " | "
            + " | ".join(fmt(e) for e in ests)
            + " |"
        )
    body.append(
        "| **Total** | | "
        + " | ".join(f"**{totals[r][0]}**" for r in used_roles)
        + " | "
        + " | ".join(f"**{fmt(totals[r][1])}**" for r in used_roles)
        + " |"
    )

    table = [header, rule, *body]

    for warning in warnings:
        print(f"warn: {warning}", file=sys.stderr)

    if args.write:
        start = end = None
        for i, line in enumerate(lines):
            if SUMMARY_HEADING_RE.match(line):
                start = i
                continue
            if start is not None and i > start and NEXT_H2_RE.match(line):
                end = i
                break
        if start is None:
            print("error: no '## Summary' section to rewrite", file=sys.stderr)
            return 2
        if end is None:
            end = len(lines)
        lines[start:end] = ["## Summary", "", *table, ""]
        args.board.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"ok: rewrote Summary in {args.board}")
    else:
        print("\n".join(table))

    if warnings:
        print(f"\n{len(warnings)} Card ID or Est problem(s) found", file=sys.stderr)
        return 1
    print(
        f"ok: {sum(t[0] for t in totals.values())} cards across {len(tally)} sprints, "
        "ids sequential and unique",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
