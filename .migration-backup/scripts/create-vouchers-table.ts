import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(connection);

console.log("Creating vouchers table...");

await connection.execute(`
  CREATE TABLE IF NOT EXISTS vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(15) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    balance_id INT NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    security_type ENUM('none', 'word', 'pin') NOT NULL DEFAULT 'none',
    security_value VARCHAR(255),
    status ENUM('active', 'activated', 'expired') NOT NULL DEFAULT 'active',
    activated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (balance_id) REFERENCES balances(id) ON DELETE CASCADE,
    FOREIGN KEY (activated_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

console.log("✓ Vouchers table created successfully!");

await connection.end();
