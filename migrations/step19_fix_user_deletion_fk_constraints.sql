-- Migration: Fix FK constraints preventing user deletion
-- Problem: fk_inventory_pending_actions_revision_requested_by blocks user deletion
-- Solution: Change revision_requested_by FK to ON DELETE SET NULL
--           Remove change_requested_by FK entirely (it can reference either users or administrator table)

-- First, rollback any aborted transaction
ROLLBACK;

-- Clean up orphan references for revision_requested_by only (it references users table)
UPDATE public.inventory_pending_actions
SET revision_requested_by = NULL
WHERE revision_requested_by IS NOT NULL
  AND revision_requested_by NOT IN (SELECT user_id FROM public.users);

-- 1. Drop existing FK constraint on revision_requested_by (if exists)
ALTER TABLE public.inventory_pending_actions
    DROP CONSTRAINT IF EXISTS fk_inventory_pending_actions_revision_requested_by;

-- 2. Recreate with ON DELETE SET NULL
ALTER TABLE public.inventory_pending_actions
    ADD CONSTRAINT fk_inventory_pending_actions_revision_requested_by 
    FOREIGN KEY (revision_requested_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

-- 3. Drop FK constraint on change_requested_by entirely
--    This column can contain either a user_id OR an admin_id (polymorphic reference)
--    so we cannot have a FK constraint on it
ALTER TABLE public.inventory_pending_actions
    DROP CONSTRAINT IF EXISTS fk_inventory_pending_actions_change_requested_by;

-- Also drop the original constraint name from step17 migration
ALTER TABLE public.inventory_pending_actions
    DROP CONSTRAINT IF EXISTS inventory_pending_actions_change_requested_by_fkey;
