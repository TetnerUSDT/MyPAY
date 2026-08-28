import mysql from 'mysql2/promise';

async function createTestNotification() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  try {
    console.log('📢 Creating test notification for all users...');
    
    // Create broadcast notification (userId = NULL for all users)
    const [result] = await connection.query(
      `INSERT INTO notifications 
       (user_id, type, title, message, is_read, created_at) 
       VALUES 
       (NULL, 'info', 'Тестовое уведомление', 'Это тестовое уведомление для всех пользователей системы SwiftX. Все работает корректно!', false, NOW())`
    ) as any;
    
    console.log('✅ Test notification created successfully!');
    console.log('   ID:', result.insertId);
    console.log('   Type: info');
    console.log('   Recipient: All users (broadcast)');
    
    // Get count of notifications
    const [count] = await connection.query(
      `SELECT COUNT(*) as total FROM notifications`
    ) as any;
    
    console.log('📊 Total notifications in database:', count[0].total);
    
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createTestNotification()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
