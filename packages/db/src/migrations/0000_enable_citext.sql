-- Custom SQL migration file, put your code below! --
-- technical-specs/06-data-model.md 6.1: subdomain, email and tag are citext
-- at rest so comparison is case-insensitive. Must run before the migration
-- that creates any table using the citext column type.
CREATE EXTENSION IF NOT EXISTS citext;