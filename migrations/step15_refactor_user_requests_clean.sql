-- =====================================================
-- REFACTOR USER REQUEST SYSTEM FOR CLEANER LOGIC
-- =====================================================
-- This migration simplifies the user account request workflow:
--
-- 1. Branch Manager creates account → pending (appears in admin approval list)
-- 2. Admin creates account → NO request record (auto-approved)
-- 3. Branch Manager cancels → request DELETED (removed from admin list + user deleted)
-- 4. Admin rejects → status=rejected (request preserved, user deleted)
-- 5. Admin deletes approved user later → status=deleted (request preserved)
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Clean up the User_Creation_Requests table structure
-- =====================================================

-- Drop the old foreign key constraint
ALTER TABLE User_Creation_Requests
    DROP CONSTRAINT IF EXISTS user_creation_requests_pending_user_id_fkey;

-- Make pending_user_id nullable (so we can preserve rejected/deleted records)
ALTER TABLE User_Creation_Requests
    ALTER COLUMN pending_user_id DROP NOT NULL;

-- Add new foreign key with ON DELETE SET NULL
-- This preserves the request history when the user is deleted
ALTER TABLE User_Creation_Requests
    ADD CONSTRAINT user_creation_requests_pending_user_id_fkey
    FOREIGN KEY (pending_user_id)
    REFERENCES Users(user_id)
    ON DELETE SET NULL;

-- =====================================================
-- STEP 2: Clean up existing data BEFORE adding constraint
-- =====================================================

-- Delete any 'cancelled' requests (they should have been deleted, not preserved)
DELETE FROM User_Creation_Requests
WHERE resolution_status = 'cancelled';

-- Delete any requests created by Owner (they should never have been created)
DELETE FROM User_Creation_Requests
WHERE creator_roles @> ARRAY['Owner']::TEXT[];

-- Handle any other invalid statuses by converting them to 'rejected'
-- This ensures we don't lose historical data
UPDATE User_Creation_Requests
SET resolution_status = 'rejected'
WHERE resolution_status NOT IN ('pending', 'approved', 'rejected', 'deleted');

-- =====================================================
-- STEP 3: Update status check constraint
-- =====================================================
ALTER TABLE User_Creation_Requests
    DROP CONSTRAINT IF EXISTS user_creation_requests_resolution_status_check;

ALTER TABLE User_Creation_Requests
    ADD CONSTRAINT user_creation_requests_resolution_status_check
    CHECK (resolution_status IN ('pending','approved','rejected','deleted'));

-- Note: 'cancelled' is removed - cancellations will DELETE the request entirely

-- =====================================================
-- STEP 4: Add helpful indexes for queries
-- =====================================================

-- Index for filtering by status (commonly used in queries)
CREATE INDEX IF NOT EXISTS user_creation_requests_status_idx
    ON User_Creation_Requests(resolution_status);

-- Index for filtering by creator (to show requests by branch manager)
CREATE INDEX IF NOT EXISTS user_creation_requests_creator_idx
    ON User_Creation_Requests(creator_user_id)
    WHERE creator_user_id IS NOT NULL;

-- Index for date range queries
CREATE INDEX IF NOT EXISTS user_creation_requests_created_at_idx
    ON User_Creation_Requests(created_at DESC);

-- =====================================================
-- STEP 5: Ensure snapshot data is populated
-- =====================================================

-- Ensure all rejected/deleted requests have their snapshot data populated
UPDATE User_Creation_Requests ucr
SET target_branch_id = COALESCE(ucr.target_branch_id, u.branch_id),
    target_branch_name = COALESCE(ucr.target_branch_name, b.branch_name),
    target_roles = COALESCE(ucr.target_roles, u.role),
    target_full_name = COALESCE(ucr.target_full_name, u.first_name || ' ' || u.last_name),
    target_username = COALESCE(ucr.target_username, lc.username),
    target_cell_number = COALESCE(ucr.target_cell_number, u.cell_number)
FROM Users u
LEFT JOIN Branch b ON b.branch_id = u.branch_id
LEFT JOIN Login_Credentials lc ON lc.user_id = u.user_id
WHERE ucr.pending_user_id = u.user_id
  AND ucr.resolution_status IN ('rejected', 'deleted')
  AND (
      ucr.target_branch_id IS NULL
      OR ucr.target_branch_name IS NULL
      OR ucr.target_roles IS NULL
      OR ucr.target_full_name IS NULL
      OR ucr.target_username IS NULL
      OR ucr.target_cell_number IS NULL
  );

-- =====================================================
-- STEP 6: Add helpful comments to columns
-- =====================================================

COMMENT ON TABLE User_Creation_Requests IS 
'Tracks user account creation requests. Only Branch Manager requests are stored here. Admin-created accounts bypass this table entirely.';

COMMENT ON COLUMN User_Creation_Requests.pending_user_id IS 
'Foreign key to Users table. NULL after user is deleted (for rejected/deleted statuses). Set to NULL on user deletion to preserve history.';

COMMENT ON COLUMN User_Creation_Requests.resolution_status IS 
'Request status: pending (awaiting admin approval), approved (admin approved), rejected (admin rejected, user deleted), deleted (approved user later deleted)';

COMMENT ON COLUMN User_Creation_Requests.creator_user_id IS 
'ID of the user who created this request. Always a Branch Manager. NULL if creator account is deleted.';

COMMENT ON COLUMN User_Creation_Requests.creator_roles IS 
'Roles of the creator at time of request creation. Used to identify Branch Manager requests.';

COMMIT;
