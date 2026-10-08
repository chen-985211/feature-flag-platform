BEGIN;

CREATE TABLE users (
    id uuid PRIMARY KEY,
    username text NOT NULL UNIQUE CHECK (length(username) BETWEEN 1 AND 80 AND username = btrim(username)),
    password_hash text NOT NULL CHECK (length(password_hash) > 0),
    display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
    role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    user_id uuid NOT NULL REFERENCES users(id),
    csrf_hash text NOT NULL CHECK (csrf_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE flags (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    key text NOT NULL CHECK (length(key) BETWEEN 1 AND 128 AND key = btrim(key)),
    environment text NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    enabled boolean NOT NULL DEFAULT true,
    default_value boolean NOT NULL DEFAULT false,
    seed uuid NOT NULL,
    revision bigint NOT NULL CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT flags_environment_key_unique UNIQUE(environment, key)
);
CREATE INDEX flags_environment_updated_idx ON flags(environment, updated_at DESC, id);

CREATE TABLE rules (
    id uuid PRIMARY KEY,
    flag_id uuid NOT NULL REFERENCES flags(id),
    priority integer NOT NULL CHECK (priority > 0),
    kind text NOT NULL CHECK (kind IN ('attribute', 'percentage')),
    attribute text,
    operator text,
    expected jsonb,
    percentage_bp integer,
    result boolean NOT NULL,
    CONSTRAINT rules_priority_unique UNIQUE(flag_id, priority) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT rules_shape CHECK (
        CASE kind
        WHEN 'percentage' THEN percentage_bp IS NOT NULL AND percentage_bp BETWEEN 0 AND 10000
            AND attribute IS NULL AND operator IS NULL AND expected IS NULL
        WHEN 'attribute' THEN percentage_bp IS NULL
            AND attribute IS NOT NULL AND length(btrim(attribute)) > 0
            AND operator IS NOT NULL AND expected IS NOT NULL
            AND CASE operator
                WHEN 'equals' THEN jsonb_typeof(expected) IN ('string', 'number', 'boolean')
                WHEN 'in' THEN CASE WHEN jsonb_typeof(expected) = 'array' THEN
                    jsonb_array_length(expected) > 0
                    AND jsonb_typeof(expected->0) IN ('string', 'number', 'boolean')
                    AND NOT jsonb_path_exists(expected, '$[*] ? (@.type() != $type)', jsonb_build_object('type', jsonb_typeof(expected->0)))
                    ELSE false END
                ELSE false END
        ELSE false END
    )
);

CREATE TABLE flag_versions (
    flag_id uuid NOT NULL REFERENCES flags(id),
    revision bigint NOT NULL CHECK (revision > 0),
    schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
    snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    actor_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(flag_id, revision)
);
-- A creation/update writes the current row and its immutable snapshot in one transaction.
ALTER TABLE flags ADD CONSTRAINT flags_current_version_fk
    FOREIGN KEY(id, revision) REFERENCES flag_versions(flag_id, revision) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE audit_entries (
    id uuid PRIMARY KEY,
    flag_id uuid NOT NULL,
    revision bigint NOT NULL,
    actor_id uuid NOT NULL REFERENCES users(id),
    actor_name text NOT NULL CHECK (length(btrim(actor_name)) > 0),
    action text NOT NULL CHECK (length(btrim(action)) > 0),
    changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'object'),
    request_id text NOT NULL CHECK (length(btrim(request_id)) > 0),
    source_flag_id uuid,
    source_revision bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(flag_id, revision) REFERENCES flag_versions(flag_id, revision),
    FOREIGN KEY(source_flag_id, source_revision) REFERENCES flag_versions(flag_id, revision),
    CHECK ((source_flag_id IS NULL) = (source_revision IS NULL))
);
CREATE INDEX audit_entries_flag_time_idx ON audit_entries(flag_id, created_at DESC, id);
CREATE INDEX audit_entries_actor_time_idx ON audit_entries(actor_id, created_at DESC, id);

COMMIT;
