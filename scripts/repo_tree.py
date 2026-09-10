#!/usr/bin/env python3
"""Print a fenced directory tree, skipping VCS, dependencies and build output.

Transcribing a tree by hand is how a structure map drifts from the repo. This
guarantees the structure; the per-folder purpose annotations are yours to add.

    python scripts/repo_tree.py . --max-depth 3
    python scripts/repo_tree.py packages --max-depth 2 --no-fence
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SKIP_DIRS = {
    ".git", ".github/workflows/__pycache__", "node_modules", "dist", "build",
    "coverage", ".turbo", "__pycache__", ".pytest_cache", ".venv", "venv",
    "playwright-report", "test-results", "web-dist", ".idea", ".vscode",
}
SKIP_FILES = {".DS_Store", "bun.lock", "package-lock.json", "yarn.lock"}


def entries(path: Path, show_hidden: bool) -> list[Path]:
    items = []
    for p in path.iterdir():
        if p.name in SKIP_DIRS or p.name in SKIP_FILES:
            continue
        if p.name.startswith(".") and not show_hidden and p.name != ".github":
            continue
        items.append(p)
    # Directories first, then files, each alphabetical.
    return sorted(items, key=lambda p: (p.is_file(), p.name.lower()))


def walk(path: Path, depth: int, max_depth: int, prefix: str, show_hidden: bool,
         out: list[str]) -> None:
    if depth > max_depth:
        return
    items = entries(path, show_hidden)
    for i, item in enumerate(items):
        last = i == len(items) - 1
        out.append(f"{prefix}{'└── ' if last else '├── '}{item.name}{'/' if item.is_dir() else ''}")
        if item.is_dir():
            if depth == max_depth:
                child_count = len(entries(item, show_hidden))
                if child_count:
                    out.append(f"{prefix}{'    ' if last else '│   '}└── ... ({child_count} entries)")
            else:
                walk(item, depth + 1, max_depth, prefix + ("    " if last else "│   "),
                     show_hidden, out)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", type=Path)
    parser.add_argument("--max-depth", type=int, default=3)
    parser.add_argument("--show-hidden", action="store_true")
    parser.add_argument("--no-fence", action="store_true")
    args = parser.parse_args(argv)

    # A Windows console defaults to cp1252 and cannot encode box-drawing
    # characters. Reconfigure rather than degrade the output to ASCII.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if not args.root.is_dir():
        print(f"error: {args.root} is not a directory", file=sys.stderr)
        return 2

    name = args.root.resolve().name
    out: list[str] = [f"{name}/"]
    walk(args.root, 1, args.max_depth, "", args.show_hidden, out)

    if not args.no_fence:
        print("```")
    print("\n".join(out))
    if not args.no_fence:
        print("```")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
