import mysql from 'mysql2/promise';
import { config } from '../server/config';

async function migrate() {
  const connection = await mysql.createConnection(config.database.url);
  
  try {
    console.log('Checking if pattern column exists...');
    
    // Check if column exists
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM balances LIKE 'pattern'`
    );
    
    if ((columns as any[]).length === 0) {
      console.log('Adding pattern column to balances table...');
      await connection.query('ALTER TABLE balances ADD COLUMN pattern TEXT DEFAULT NULL');
      console.log('✓ Pattern column added');
      
      // Add sample patterns for existing balances
      console.log('Updating existing balances with patterns...');
      await connection.query(`UPDATE balances SET pattern = '^T[A-Za-z0-9]{33}$' WHERE title LIKE '%TRC20%' OR network = 'TRC20'`);
      await connection.query(`UPDATE balances SET pattern = '^0x[a-fA-F0-9]{40}$' WHERE title LIKE '%BEP20%' OR network = 'BEP20'`);
      await connection.query(`UPDATE balances SET pattern = '^(EQA|EQB|EQ[C-J])[A-Za-z0-9_-]{45}$' WHERE title LIKE '%TON%' OR network = 'TON'`);
      console.log('✓ Patterns updated for existing balances');
    } else {
      console.log('✓ Pattern column already exists');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
  
  console.log('Migration completed successfully!');
}

migrate().catch(console.error);
