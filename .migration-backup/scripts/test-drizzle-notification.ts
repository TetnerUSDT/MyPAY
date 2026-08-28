import { db } from '../server/db';
import { notifications } from '../shared/schema';

async function testDrizzleNotification() {
  try {
    console.log('📢 Testing Drizzle notification creation...');
    
    const [result] = await db.insert(notifications).values({
      userId: null, // Broadcast to all users
      type: 'promotion',
      title: 'Тестовое уведомление через Drizzle',
      message: 'Это уведомление создано через Drizzle ORM для проверки работы системы',
      isRead: false,
    });
    
    console.log('✅ Notification created successfully via Drizzle!');
    console.log('   Result:', result);
    
    // Query to verify
    const allNotifications = await db.select().from(notifications);
    console.log('📊 Total notifications:', allNotifications.length);
    
  } catch (error) {
    console.error('❌ Error creating notification via Drizzle:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

testDrizzleNotification();
