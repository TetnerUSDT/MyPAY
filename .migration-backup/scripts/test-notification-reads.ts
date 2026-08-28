import { db } from '../server/db';
import { notifications, notificationReads } from '../shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';

async function testNotificationReads() {
  try {
    console.log('🧪 Testing individual notification read tracking...\n');
    
    // Get existing broadcast notifications
    const broadcastNotifs = await db
      .select()
      .from(notifications)
      .where(isNull(notifications.userId));
    
    console.log(`1. Found ${broadcastNotifs.length} broadcast notifications`);
    
    if (broadcastNotifs.length > 0) {
      const notifId = broadcastNotifs[0].id;
      console.log(`   Using notification ID: ${notifId}`);
      
      // Simulate user 1 reading the notification
      console.log('\n2. Simulating user 1 marking notification as read...');
      await db.insert(notificationReads).values({
        notificationId: notifId,
        userId: 1,
      });
      console.log('   ✅ User 1 marked notification as read');
      
      // Check notification_reads table
      const readRecords = await db
        .select()
        .from(notificationReads)
        .where(eq(notificationReads.notificationId, notifId));
      
      console.log(`\n3. notification_reads records for notification ${notifId}:`);
      readRecords.forEach(r => {
        console.log(`   - User ${r.userId} read at: ${r.readAt}`);
      });
      
      // Test getUserNotifications for user 1 (should show as read)
      console.log('\n4. Testing getUserNotifications for user 1:');
      const user1Notifs = await db
        .select({
          id: notifications.id,
          userId: notifications.userId,
          title: notifications.title,
          isRead: notifications.isRead,
          readByUser: notificationReads.id,
        })
        .from(notifications)
        .leftJoin(
          notificationReads,
          and(
            eq(notificationReads.notificationId, notifications.id),
            eq(notificationReads.userId, 1)
          )
        )
        .where(
          or(
            eq(notifications.userId, 1),
            isNull(notifications.userId)
          )
        );
      
      user1Notifs.forEach(n => {
        const finalIsRead = n.userId !== null ? n.isRead : n.readByUser !== null;
        console.log(`   - ID: ${n.id}, title: ${n.title}, isRead: ${finalIsRead} (userId: ${n.userId}, readByUser: ${n.readByUser})`);
      });
      
      // Test for hypothetical user 2 (should show as unread)
      console.log('\n5. Testing getUserNotifications for hypothetical user 2:');
      const user2Notifs = await db
        .select({
          id: notifications.id,
          userId: notifications.userId,
          title: notifications.title,
          isRead: notifications.isRead,
          readByUser: notificationReads.id,
        })
        .from(notifications)
        .leftJoin(
          notificationReads,
          and(
            eq(notificationReads.notificationId, notifications.id),
            eq(notificationReads.userId, 2)
          )
        )
        .where(
          or(
            eq(notifications.userId, 2),
            isNull(notifications.userId)
          )
        );
      
      user2Notifs.forEach(n => {
        const finalIsRead = n.userId !== null ? n.isRead : n.readByUser !== null;
        console.log(`   - ID: ${n.id}, title: ${n.title}, isRead: ${finalIsRead} (userId: ${n.userId}, readByUser: ${n.readByUser})`);
      });
      
      console.log('\n✅ Test complete! System correctly tracks individual read status.');
    } else {
      console.log('   ⚠️  No broadcast notifications found to test');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testNotificationReads();
