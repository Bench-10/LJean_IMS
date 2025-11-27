-- Create inventory request change history table
-- This table tracks all changes made to inventory pending requests
-- Uses text fields for user info to avoid foreign key constraints when users are deleted

CREATE TABLE IF NOT EXISTS inventory_request_history (
    history_id SERIAL PRIMARY KEY,
    pending_id INTEGER NOT NULL REFERENCES inventory_pending_actions(pending_id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'approve', 'reject', 'request_changes', 'resubmit', etc.
    action_description TEXT NOT NULL, -- Human-readable description of the action
    user_name VARCHAR(255), -- Name of the user who performed the action (not a foreign key)
    user_role VARCHAR(100), -- Role of the user who performed the action
    action_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_payload JSONB, -- Previous state of the request (if applicable)
    new_payload JSONB, -- New state of the request (if applicable)
    additional_data JSONB, -- Extra information like rejection reasons, change request details, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_inventory_request_history_pending_id ON inventory_request_history(pending_id);
CREATE INDEX IF NOT EXISTS idx_inventory_request_history_action_date ON inventory_request_history(action_date);
CREATE INDEX IF NOT EXISTS idx_inventory_request_history_action_type ON inventory_request_history(action_type);

-- Add comment
COMMENT ON TABLE inventory_request_history IS 'Tracks all changes and actions performed on inventory pending requests';
COMMENT ON COLUMN inventory_request_history.user_name IS 'User name stored as text to avoid foreign key constraints';
COMMENT ON COLUMN inventory_request_history.user_role IS 'User role stored as text for historical reference';