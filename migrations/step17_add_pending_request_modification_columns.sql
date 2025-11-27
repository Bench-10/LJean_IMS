ALTER TABLE Inventory_Pending_Actions
ADD COLUMN IF NOT EXISTS change_requested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS change_request_type text,
ADD COLUMN IF NOT EXISTS change_request_comment text,
ADD COLUMN IF NOT EXISTS change_requested_by integer,
ADD COLUMN IF NOT EXISTS change_requested_at timestamp without time zone;


ALTER TABLE IF EXISTS Inventory_Pending_Actions
ADD CONSTRAINT inventory_pending_actions_change_requested_by_fkey
FOREIGN KEY (change_requested_by) REFERENCES Users(user_id) MATCH SIMPLE
ON UPDATE NO ACTION
ON DELETE SET NULL;
