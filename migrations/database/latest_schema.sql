-- LATEST DATABASE SCHEMA

CREATE TABLE Branch (
    branch_id INT PRIMARY KEY,
    branch_name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    cellphone_num VARCHAR(20) NOT NULL,
    telephone_num VARCHAR(20) NOT NULL,
    branch_email VARCHAR(100) NOT NULL
);

CREATE TABLE Administrator (
    admin_id SERIAL PRIMARY KEY,
    role TEXT[],
    username VARCHAR(225),
    password VARCHAR(225),
    first_name VARCHAR(100),
    last_name VARCHAR(100)
);

CREATE TABLE Users (
    user_id INT PRIMARY KEY,
    branch_id INT NOT NULL,
    role TEXT[] NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    cell_number VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    hire_date DATE DEFAULT CURRENT_DATE,
    last_login VARCHAR(40),
    permissions TEXT[],
    address VARCHAR(255),
    is_disabled BOOL DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_by VARCHAR(225),
    approved_by VARCHAR(225),
    approved_at TIMESTAMP,
    FOREIGN KEY(branch_id) REFERENCES Branch(branch_id)
);

CREATE INDEX idx_users_status ON Users(status);

CREATE TABLE Login_Credentials (
    user_id INT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Category (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(255) NOT NULL
);

CREATE TABLE Products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(100),
    description TEXT DEFAULT 'N/A'
);

CREATE TABLE Inventory_Product (
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    category_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit VARCHAR(15) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    quantity INT,
    min_threshold INT NOT NULL,
    max_threshold INT NOT NULL,
    low_stock_notified BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (product_id, branch_id),
    FOREIGN KEY (category_id) REFERENCES Category(category_id),
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

CREATE TABLE Add_Stocks (
    add_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    h_unit_price DECIMAL(10,2) NOT NULL,
    h_unit_cost DECIMAL(10,2) NOT NULL,
    quantity_added DECIMAL(10,2) NOT NULL,
    quantity_left DECIMAL(10,2) NOT NULL,
    date_added DATE NOT NULL,
    product_validity DATE NOT NULL,
    FOREIGN KEY (product_id, branch_id) REFERENCES Inventory_Product(product_id, branch_id)
);

CREATE TABLE Inventory_Alerts (
    alert_id SERIAL PRIMARY KEY,
    product_id INT,
    branch_id INT,
    alert_type VARCHAR(100),
    message VARCHAR(255),
    banner_color VARCHAR(25),
    user_id INT,
    user_full_name VARCHAR(100),
    alert_date TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (product_id, branch_id) REFERENCES Inventory_Product(product_id, branch_id),
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id)
);

CREATE TABLE inventory_alert_history_links (
    alert_id INT PRIMARY KEY REFERENCES Inventory_Alerts(alert_id) ON DELETE CASCADE,
    add_id INT NOT NULL REFERENCES Add_Stocks(add_id) ON DELETE CASCADE,
    alert_timestamp TIMESTAMPTZ DEFAULT NOW(),
    history_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT inventory_alert_history_links_add_id_key UNIQUE (add_id)
);

CREATE INDEX idx_inventory_alert_history_links_add_id
    ON inventory_alert_history_links(add_id);

CREATE INDEX idx_inventory_alert_history_links_history_timestamp
    ON inventory_alert_history_links(history_timestamp);

CREATE TABLE user_notification (
    user_id INT,
    alert_id INT,
    is_read BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES Inventory_Alerts(alert_id)
);

CREATE TABLE admin_notification (
    admin_id INT,
    alert_id INT,
    is_read BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (admin_id, alert_id),
    FOREIGN KEY (admin_id) REFERENCES Administrator(admin_id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES Inventory_Alerts(alert_id) ON DELETE CASCADE
);

CREATE TABLE Sales_Information (
    sales_information_id INT PRIMARY KEY,
    branch_id INT,
    charge_to VARCHAR(255),
    tin VARCHAR(50),
    address VARCHAR(255),
    date DATE,
    vat DECIMAL(10, 2),
    amount_net_vat DECIMAL(10, 2),
    total_amount_due DECIMAL(10, 2),
    discount DECIMAL(10,2),
    transaction_by VARCHAR(100),
    delivery_fee INT,
    is_for_delivery BOOLEAN,
    FOREIGN KEY(branch_id) REFERENCES Branch(branch_id)
);

CREATE TABLE Sales_Items (
    product_item_id SERIAL PRIMARY KEY,
    sales_information_id INT,
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    quantity DECIMAL(10,2),
    unit VARCHAR(50),
    unit_price DECIMAL(10, 2),
    amount DECIMAL(10, 2),
    FOREIGN KEY (sales_information_id) REFERENCES Sales_Information(sales_information_id),
    FOREIGN KEY (product_id, branch_id) REFERENCES Inventory_Product(product_id, branch_id)
);

CREATE TABLE Delivery (
    delivery_id INT PRIMARY KEY,
    sales_information_id INT,
    branch_id INT,
    destination_address VARCHAR(255),
    delivered_date DATE,
    courier_name VARCHAR(255),
    is_delivered BOOLEAN,
    is_pending BOOLEAN
);

CREATE TABLE Sales_Stock_Usage (
    usage_id SERIAL PRIMARY KEY,
    sales_information_id INT NOT NULL,
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    add_stock_id INT NOT NULL,
    quantity_used DECIMAL(10,2) NOT NULL,
    date_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_restored BOOLEAN DEFAULT FALSE,
    restored_date TIMESTAMP,
    FOREIGN KEY (sales_information_id) REFERENCES Sales_Information(sales_information_id),
    FOREIGN KEY (product_id, branch_id) REFERENCES Inventory_Product(product_id, branch_id),
    FOREIGN KEY (add_stock_id) REFERENCES Add_Stocks(add_id)
);

CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NULL,
    admin_id INT NULL,
    user_type VARCHAR(10) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES Administrator(admin_id) ON DELETE CASCADE,
    UNIQUE(user_id, admin_id, user_type)
);

CREATE TABLE Inventory_Pending_Actions (
    pending_id SERIAL PRIMARY KEY,
    branch_id INT NOT NULL REFERENCES Branch(branch_id),
    product_id INT NULL,
    action_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    current_stage TEXT NOT NULL DEFAULT 'manager_review',
    requires_admin_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT NOT NULL REFERENCES Users(user_id),
    created_by_name TEXT,
    created_by_roles TEXT[],
    manager_approver_id INT REFERENCES Users(user_id),
    manager_approved_at TIMESTAMP,
    admin_approver_id INT REFERENCES Administrator(admin_id)
);