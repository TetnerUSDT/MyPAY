import mysql from 'mysql2/promise';

async function migrate() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  try {
    console.log('Adding trust and phone fields to users table...');
    
    // Check if trust column exists
    const [trustExists] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'trust'
    `);
    
    if ((trustExists as any)[0].count === 0) {
      await connection.execute('ALTER TABLE users ADD COLUMN trust INT DEFAULT 0');
      console.log('✅ Added trust column');
    } else {
      console.log('ℹ️  trust column already exists');
    }
    
    // Check if phone column exists
    const [phoneExists] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'phone'
    `);
    
    if ((phoneExists as any)[0].count === 0) {
      await connection.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
      console.log('✅ Added phone column');
    } else {
      console.log('ℹ️  phone column already exists');
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
