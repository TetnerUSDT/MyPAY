import { db } from '../server/db';
import { notifications } from '../shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';

async function debugNotifications() {
  try {
    console.log('🔍 Debugging notifications...\n');
    
    // 1. Get all notifications
    console.log('1. All notifications in database:');
    const allNotifications = await db.select().from(notifications);
    console.log('   Count:', allNotifications.length);
    allNotifications.forEach(n => {
      console.log(`   - ID: ${n.id}, userId: ${n.userId}, type: ${n.type}, isRead: ${n.isRead}, title: ${n.title}`);
    });
    
    console.log('\n2. Testing getUserNotifications for userId=1:');
    const userNotifications = await db.select().from(notifications).where(
      or(
        eq(notifications.userId, 1),
        isNull(notifications.userId)
      )
    ).orderBy(sql`${notifications.createdAt} DESC`);
    console.log('   Count:', userNotifications.length);
    userNotifications.forEach(n => {
      console.log(`   - ID: ${n.id}, userId: ${n.userId}, type: ${n.type}, isRead: ${n.isRead}, title: ${n.title}`);
    });
    
    console.log('\n3. Testing getUnreadNotificationsCount for userId=1:');
    const unreadCount = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(
      and(
        or(
          eq(notifications.userId, 1),
          isNull(notifications.userId)
        ),
        eq(notifications.isRead, false)
      )
    );
    console.log('   Unread count:', unreadCount[0]?.count);
    
    console.log('\n4. Checking isRead values directly:');
    const isReadValues = await db.select({
      id: notifications.id,
      isRead: notifications.isRead,
      isReadRaw: sql<any>`is_read`
    }).from(notifications);
    isReadValues.forEach(v => {
      console.log(`   - ID: ${v.id}, isRead (Drizzle): ${v.isRead}, isRead (Raw): ${v.isReadRaw}, Type: ${typeof v.isRead}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

debugNotifications();
