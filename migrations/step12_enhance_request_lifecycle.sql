BEGIN;

-- Inventory request cancellation tracking
ALTER TABLE Inventory_Pending_Actions
    ADD COLUMN IF NOT EXISTS cancelled_by INT REFERENCES Users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- User creation request lifecycle tracking
ALTER TABLE User_Creation_Requests
    ADD COLUMN IF NOT EXISTS manager_approver_id INT REFERENCES Users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS owner_resolved_by INT REFERENCES Administrator(admin_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by_user_id INT REFERENCES Users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_by_admin_id INT REFERENCES Administrator(admin_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS target_branch_id INT,
    ADD COLUMN IF NOT EXISTS target_branch_name TEXT,
    ADD COLUMN IF NOT EXISTS target_roles TEXT[],
    ADD COLUMN IF NOT EXISTS target_full_name TEXT,
    ADD COLUMN IF NOT EXISTS target_username TEXT,
    ADD COLUMN IF NOT EXISTS target_cell_number TEXT;

-- Allow additional resolution states
ALTER TABLE User_Creation_Requests
    DROP CONSTRAINT IF EXISTS user_creation_requests_resolution_status_check;

ALTER TABLE User_Creation_Requests
    ADD CONSTRAINT user_creation_requests_resolution_status_check
    CHECK (resolution_status IN ('pending','approved','rejected','deleted','cancelled'));

-- Backfill snapshot details for existing records
UPDATE User_Creation_Requests ucr
SET target_branch_id = COALESCE(ucr.target_branch_id, u.branch_id),
    target_branch_name = COALESCE(ucr.target_branch_name, b.branch_name),
    target_roles = COALESCE(ucr.target_roles, u.role),
    target_full_name = COALESCE(ucr.target_full_name, TRIM(CONCAT(u.first_name, ' ', u.last_name))),
    target_username = COALESCE(ucr.target_username, lc.username),
    target_cell_number = COALESCE(ucr.target_cell_number, u.cell_number)
FROM Users u
LEFT JOIN Branch b ON b.branch_id = u.branch_id
LEFT JOIN Login_Credentials lc ON lc.user_id = u.user_id
WHERE ucr.pending_user_id = u.user_id;

-- Default manager approval metadata to creator for legacy rows
UPDATE User_Creation_Requests
SET manager_approver_id = COALESCE(manager_approver_id, creator_user_id),
    manager_approved_at = COALESCE(manager_approved_at, created_at)
WHERE manager_approver_id IS NULL;

COMMIT;
