import { db } from './db';
import { sql } from 'drizzle-orm';

async function migrateReactionFields() {
  try {
    console.log('🔄 Adding new fields to bot_command_reactions table...');

    // Check if columns already exist and add them if they don't
    const columns = ['image_url', 'link_url', 'link_text'];
    
    for (const column of columns) {
      try {
        if (column === 'image_url') {
          await db.execute(sql`ALTER TABLE bot_command_reactions ADD COLUMN image_url TEXT`);
          console.log(`✅ Added column: ${column}`);
        } else if (column === 'link_url') {
          await db.execute(sql`ALTER TABLE bot_command_reactions ADD COLUMN link_url TEXT`);
          console.log(`✅ Added column: ${column}`);
        } else if (column === 'link_text') {
          await db.execute(sql`ALTER TABLE bot_command_reactions ADD COLUMN link_text VARCHAR(255)`);
          console.log(`✅ Added column: ${column}`);
        }
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️ Column ${column} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateReactionFields();
