-- Migration: Create push_subscriptions table
-- Purpose: Store web push notification subscriptions for users and admins

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id INT NULL,
    admin_id INT NULL,
    user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('user', 'admin')),
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    device_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES Administrator(admin_id) ON DELETE CASCADE,
    UNIQUE(endpoint)
);

-- Indexes for performance
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_push_subscriptions_admin ON push_subscriptions(admin_id) WHERE admin_id IS NOT NULL;
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX idx_push_subscriptions_user_type ON push_subscriptions(user_type);

-- Constraint: Either user_id or admin_id must be set, but not both
ALTER TABLE push_subscriptions 
ADD CONSTRAINT chk_push_subscriptions_user_xor_admin 
CHECK (
    (user_id IS NOT NULL AND admin_id IS NULL) OR 
    (user_id IS NULL AND admin_id IS NOT NULL)
);

COMMIT;
