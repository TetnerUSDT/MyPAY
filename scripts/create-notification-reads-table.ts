import mysql from 'mysql2/promise';

async function createNotificationReadsTable() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  try {
    console.log('📊 Creating notification_reads table...');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_notification_user (notification_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ notification_reads table created successfully!');
    
    // Verify table
    const [tables] = await connection.query(
      `SHOW TABLES LIKE 'notification_reads'`
    ) as any;
    
    if (tables.length > 0) {
      console.log('✅ Verification successful: notification_reads table exists');
      
      // Show structure
      const [columns] = await connection.query(
        `SHOW COLUMNS FROM notification_reads`
      ) as any;
      
      console.log('\n📋 Table structure:');
      columns.forEach((col: any) => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createNotificationReadsTable()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
