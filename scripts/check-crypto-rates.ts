import mysql from 'mysql2/promise';
import { config } from '../server/config';

async function checkCryptoRates() {
  const connection = await mysql.createConnection(config.database.url);
  
  try {
    console.log('Checking crypto exchange rates...\n');
    
    const [rates] = await connection.query(`
      SELECT id, from_balance_id, to_balance_id, from_currency, to_currency, category, rate 
      FROM exchange_rates 
      WHERE category = 'crypto'
    `);
    
    console.log('Crypto exchange rates:', JSON.stringify(rates, null, 2));
    
    if ((rates as any[]).length === 0) {
      console.log('\n⚠️  No crypto exchange rates found!');
    } else {
      console.log(`\n✓ Found ${(rates as any[]).length} crypto exchange rate(s)`);
      
      // Check balances
      for (const rate of rates as any[]) {
        const [fromBalance] = await connection.query(
          'SELECT id, title, network, currency FROM balances WHERE id = ?', 
          [rate.from_balance_id]
        );
        const [toBalance] = await connection.query(
          'SELECT id, title, network, currency FROM balances WHERE id = ?', 
          [rate.to_balance_id]
        );
        
        console.log(`\nRate: ${rate.from_currency} → ${rate.to_currency}`);
        console.log('From balance:', fromBalance);
        console.log('To balance:', toBalance);
      }
    }
    
  } finally {
    await connection.end();
  }
}

checkCryptoRates().catch(console.error);
