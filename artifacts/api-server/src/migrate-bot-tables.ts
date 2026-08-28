import { pool } from "./db";

async function migrateBotTables() {
  console.log("Creating Telegram bot tables...");
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS bot_commands (
      id INT AUTO_INCREMENT PRIMARY KEY,
      command VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS bot_command_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      command_id INT NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_name VARCHAR(255),
      file_size INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (command_id) REFERENCES bot_commands(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS bot_command_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      command_id INT NOT NULL,
      reaction_type VARCHAR(50) NOT NULL,
      text_content TEXT,
      image_url VARCHAR(500),
      endpoint_url VARCHAR(500),
      endpoint_method VARCHAR(10),
      endpoint_auth JSON,
      endpoint_params JSON,
      format_template TEXT,
      conditions JSON,
      priority INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (command_id) REFERENCES bot_commands(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS bot_menus (
      id INT AUTO_INCREMENT PRIMARY KEY,
      parent_menu_id INT,
      title VARCHAR(255) NOT NULL,
      keyboard_type VARCHAR(20) NOT NULL DEFAULT 'reply',
      \`rows\` INT DEFAULT 1,
      \`columns\` INT DEFAULT 1,
      is_root BOOLEAN DEFAULT FALSE,
      auto_back_button BOOLEAN DEFAULT TRUE,
      back_button_text VARCHAR(100) DEFAULT '◀️ Назад',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_menu_id) REFERENCES bot_menus(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS bot_menu_buttons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_id INT NOT NULL,
      text VARCHAR(255) NOT NULL,
      row_index INT NOT NULL DEFAULT 0,
      column_index INT NOT NULL DEFAULT 0,
      action_type VARCHAR(50) NOT NULL,
      action_value TEXT,
      submenu_id INT,
      command_id INT,
      url VARCHAR(500),
      file_url VARCHAR(500),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menu_id) REFERENCES bot_menus(id) ON DELETE CASCADE,
      FOREIGN KEY (submenu_id) REFERENCES bot_menus(id) ON DELETE SET NULL,
      FOREIGN KEY (command_id) REFERENCES bot_commands(id) ON DELETE SET NULL
    )`
  ];
  
  try {
    for (const sql of tables) {
      await pool.query(sql);
    }
    console.log("✅ Bot tables created successfully");
  } catch (error) {
    console.error("❌ Error creating bot tables:", error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateBotTables()
    .then(() => {
      console.log("Migration complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateBotTables };
