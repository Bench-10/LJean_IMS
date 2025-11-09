BEGIN;

-- Fix User_Creation_Requests foreign key to preserve rejected request history
-- when the pending user is deleted from Users table after rejection.
-- Change ON DELETE CASCADE to ON DELETE SET NULL so the request row persists
-- with the snapshot data preserved in target_* columns.

ALTER TABLE User_Creation_Requests
    DROP CONSTRAINT IF EXISTS user_creation_requests_pending_user_id_fkey;

ALTER TABLE User_Creation_Requests
    ALTER COLUMN pending_user_id DROP NOT NULL;

ALTER TABLE User_Creation_Requests
    ADD CONSTRAINT user_creation_requests_pending_user_id_fkey
    FOREIGN KEY (pending_user_id)
    REFERENCES Users(user_id)
    ON DELETE SET NULL;

-- Ensure all rejected/deleted/cancelled requests have snapshot data populated
-- (This handles any existing records that were rejected before the snapshot columns were added)
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
WHERE ucr.pending_user_id = u.user_id
  AND ucr.resolution_status IN ('rejected', 'deleted', 'cancelled')
  AND (
      ucr.target_branch_id IS NULL
      OR ucr.target_branch_name IS NULL
      OR ucr.target_roles IS NULL
      OR ucr.target_full_name IS NULL
      OR ucr.target_username IS NULL
      OR ucr.target_cell_number IS NULL
  );

COMMIT;
