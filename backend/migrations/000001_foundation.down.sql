BEGIN;
DROP TABLE audit_entries;
ALTER TABLE flags DROP CONSTRAINT flags_current_version_fk;
DROP TABLE flag_versions;
DROP TABLE rules;
DROP TABLE flags;
DROP TABLE sessions;
DROP TABLE users;
COMMIT;
