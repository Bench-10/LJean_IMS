-- Step 7: Link inventory alerts to add stock history entries
-- Creates a bridge table so notifications can target the exact history row

CREATE TABLE IF NOT EXISTS inventory_alert_history_links (
    alert_id INT PRIMARY KEY REFERENCES Inventory_Alerts(alert_id) ON DELETE CASCADE,
    add_id INT NOT NULL REFERENCES Add_Stocks(add_id) ON DELETE CASCADE,
    alert_timestamp TIMESTAMPTZ DEFAULT NOW(),
    history_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT inventory_alert_history_links_add_id_key UNIQUE (add_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_alert_history_links_add_id
    ON inventory_alert_history_links(add_id);

CREATE INDEX IF NOT EXISTS idx_inventory_alert_history_links_history_timestamp
    ON inventory_alert_history_links(history_timestamp);
