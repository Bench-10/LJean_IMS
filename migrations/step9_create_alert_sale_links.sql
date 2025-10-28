CREATE TABLE IF NOT EXISTS inventory_alert_sale_links (
    alert_id INT PRIMARY KEY REFERENCES Inventory_Alerts(alert_id) ON DELETE CASCADE,
    sales_information_id INT,
    delivery_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_alert_sale_links_sale_id
    ON inventory_alert_sale_links(sales_information_id);

CREATE INDEX IF NOT EXISTS idx_inventory_alert_sale_links_delivery_id
    ON inventory_alert_sale_links(delivery_id);
