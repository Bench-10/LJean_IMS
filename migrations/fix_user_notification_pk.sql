-- Fix user_notification table to prevent duplicate (user_id, alert_id) rows
-- This migration adds a composite primary key and cleans up any existing duplicates

-- Step 1: Remove duplicate rows, keeping only the most recent (highest is_read value)
DELETE FROM user_notification un1
WHERE EXISTS (
    SELECT 1
    FROM user_notification un2
    WHERE un2.user_id = un1.user_id
      AND un2.alert_id = un1.alert_id
      AND (
          un2.is_read > un1.is_read
          OR (un2.is_read = un1.is_read AND un2.ctid > un1.ctid)
      )
);

-- Step 2: Add composite primary key to prevent future duplicates
ALTER TABLE user_notification
ADD CONSTRAINT user_notification_pkey PRIMARY KEY (user_id, alert_id);
