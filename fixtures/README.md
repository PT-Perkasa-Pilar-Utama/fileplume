# Fixtures

Files the acceptance criteria name by filename. A test **uploads** these; the
seeds never insert them.

Regenerate with `bun run scripts/generate_fixtures.ts`. It is deterministic:
nothing here depends on the clock, so a regeneration that changes a committed
file means the generator changed, not the run.

## Why these are files and not seeded rows

`packages/db/src/seeds/` writes rows only. The reset sequence purges the blob
bucket prefix and recreates the search index *after* the seed runs
([05-module-definitions.md 5.8.2](../docs/technical-specs/05-module-definitions.md)),
so anything a seed wrote to either store would be destroyed a step later.

That settles each of these cases:

- AC-01.06 and AC-46.02 are negative paths. The file must never reach the
  database, so it cannot be a row by definition.
- AC-06.01 and AC-33.01 need the pipeline to have run — a classification, and
  an OpenSearch index entry. Only a real upload produces either.
- AC-03.01 needs two uploads of identical bytes, not a pre-existing row: the
  seeded `content_hash` values describe bytes no blob store holds, so they
  cannot collide with a real file's hash.

## Committed

| File | Serves | Notes |
|---|---|---|
| `fixture-reporting-01.pdf` | AC-06.01 | Content the classifier should file under `Reporting`, which the seeds create |
| `kontrak-kerjasama.pdf` | AC-33.01 | 16 pages; `klausul-kerahasiaan` is on page 15 and nowhere else |
| `presentasi-baru.pdf` | AC-03.02 | Different content, so it becomes its own document rather than a version |
| `laporan-keuangan.pdf` | AC-03.01 | Upload first |
| `laporan-keuangan-salinan.pdf` | AC-03.01 | Byte-identical to the above; the second upload must lose on `UNIQUE (tenant_id, content_hash)` |

The PDFs use uncompressed text streams so any extractor can read them without
a filter it might not implement.

## Generated, never committed

`fixtures/generated/` is gitignored.

| File | Serves | Why not committed |
|---|---|---|
| `berkas-25mb.pdf` | AC-01.06 | 25 MB in git bloats every clone forever |
| `eicar.com` | AC-46.02 | The EICAR test signature is quarantined on sight by most antivirus |

**Windows:** Defender will quarantine `eicar.com` as it is written. Add a
Defender exclusion for `fixtures/generated/` before running the generator, or
the file will vanish between being written and being read. This is Defender
behaving correctly — EICAR exists precisely to be detected.

## Not fixtures

Filenames the criteria name as *already present* — `laporan.pdf`,
`proposal.pdf`, `technical-proposal-test.pdf`, `bds-requirement.xlsx`,
`laporan-keuangan.pdf` as a row, and `rahasia-b.pdf` in the second tenant —
are seeded rows, not files. See `packages/db/src/seeds/`.
