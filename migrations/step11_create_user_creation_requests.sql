BEGIN;

CREATE TABLE IF NOT EXISTS User_Creation_Requests (
    request_id SERIAL PRIMARY KEY,
    pending_user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    creator_user_id INT REFERENCES Users(user_id) ON DELETE SET NULL,
    creator_name TEXT,
    creator_roles TEXT[],
    resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending','approved','rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS user_creation_requests_pending_user_id_idx
    ON User_Creation_Requests(pending_user_id);

CREATE INDEX IF NOT EXISTS user_creation_requests_creator_user_id_idx
    ON User_Creation_Requests(creator_user_id);

INSERT INTO User_Creation_Requests (pending_user_id, creator_user_id, creator_name, creator_roles, resolution_status, created_at, resolved_at)
SELECT
    u.user_id,
    CASE
        WHEN COALESCE(u.created_by, '') ~ '^\\s*\\d+\\s*$'
             AND EXISTS (
                 SELECT 1 FROM Users parent WHERE parent.user_id = TRIM(u.created_by)::INT
             )
        THEN TRIM(u.created_by)::INT
        ELSE NULL
    END AS creator_user_id,
    NULLIF(TRIM(u.created_by), '') AS creator_name,
    NULL::TEXT[] AS creator_roles,
    CASE
        WHEN LOWER(u.status) = 'pending' THEN 'pending'
        WHEN LOWER(u.status) = 'rejected' THEN 'rejected'
        ELSE 'approved'
    END AS resolution_status,
    COALESCE(u.hire_date::TIMESTAMPTZ, u.approved_at, NOW()) AS created_at,
    CASE
        WHEN LOWER(u.status) = 'pending' THEN NULL
        ELSE COALESCE(u.approved_at, NOW())
    END AS resolved_at
FROM Users u
LEFT JOIN User_Creation_Requests existing ON existing.pending_user_id = u.user_id
WHERE existing.pending_user_id IS NULL;

ALTER TABLE Users
DROP COLUMN IF EXISTS created_by_id;

COMMIT;
