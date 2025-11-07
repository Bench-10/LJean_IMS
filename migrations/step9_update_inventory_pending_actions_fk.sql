ALTER TABLE Inventory_Pending_Actions
DROP CONSTRAINT IF EXISTS inventory_pending_actions_created_by_fkey;

ALTER TABLE Inventory_Pending_Actions
ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE Inventory_Pending_Actions
ADD CONSTRAINT inventory_pending_actions_created_by_fkey
FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE SET NULL;

ALTER TABLE Inventory_Pending_Actions
DROP CONSTRAINT IF EXISTS inventory_pending_actions_manager_approver_id_fkey;

ALTER TABLE Inventory_Pending_Actions
ALTER COLUMN manager_approver_id DROP NOT NULL;

ALTER TABLE Inventory_Pending_Actions
ADD CONSTRAINT inventory_pending_actions_manager_approver_id_fkey
FOREIGN KEY (manager_approver_id) REFERENCES Users(user_id) ON DELETE SET NULL;

ALTER TABLE Inventory_Pending_Actions
DROP CONSTRAINT IF EXISTS inventory_pending_actions_approved_by_fkey;

ALTER TABLE Inventory_Pending_Actions
ALTER COLUMN approved_by DROP NOT NULL;

ALTER TABLE Inventory_Pending_Actions
ADD CONSTRAINT inventory_pending_actions_approved_by_fkey
FOREIGN KEY (approved_by) REFERENCES Users(user_id) ON DELETE SET NULL;
