import mysql from 'mysql2/promise';

async function fixNotificationColumn() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  try {
    console.log('🔧 Fixing notification_type column name...');
    
    // Check if notification_type column exists
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM notifications WHERE Field = 'notification_type'`
    ) as any;
    
    if (columns.length > 0) {
      console.log('Found notification_type column, renaming to type...');
      await connection.query(
        `ALTER TABLE notifications CHANGE COLUMN notification_type type VARCHAR(20) NOT NULL DEFAULT 'info'`
      );
      console.log('✅ Successfully renamed notification_type to type');
    } else {
      console.log('✅ Column already has correct name (type)');
    }
    
    // Verify the change
    const [result] = await connection.query(
      `SHOW COLUMNS FROM notifications WHERE Field = 'type'`
    ) as any;
    
    if (result.length > 0) {
      console.log('✅ Verification successful: type column exists');
    } else {
      console.log('❌ Error: type column not found');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

fixNotificationColumn()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
