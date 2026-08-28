-- Add notifications and invoices tables to MySQL database

-- Create invoices table first (referenced by notifications)
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  wallet_id INT,
  balance_id INT NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  network VARCHAR(50),
  description TEXT,
  payment_method VARCHAR(20),
  status ENUM('pending', 'paid', 'expired', 'canceled') NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  payment_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
  FOREIGN KEY (balance_id) REFERENCES balances(id) ON DELETE SET NULL
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type ENUM('info', 'invoice', 'exchange', 'promotion') NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  image_url VARCHAR(500),
  video_url VARCHAR(500),
  link_url VARCHAR(500),
  link_text VARCHAR(100),
  redirect_to VARCHAR(255),
  invoice_id INT,
  exchange_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_order_number ON invoices(order_number);
