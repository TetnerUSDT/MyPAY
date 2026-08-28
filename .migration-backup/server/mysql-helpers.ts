import { db } from './db';
import { sql } from 'drizzle-orm';

// Convert snake_case keys to camelCase
function snakeToCamel(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  
  const camelObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = snakeToCamel(obj[key]);
  }
  return camelObj;
}

// MySQL-specific helper: Insert and return the inserted row
export async function insertAndReturn<T extends any>(
  query: any,
  tableName: string
): Promise<T> {
  const result = await query;
  const insertId = result[0].insertId;
  const rows = await db.execute(sql.raw(`SELECT * FROM ${tableName} WHERE id = ${insertId}`));
  const row = rows[0][0];
  // Convert snake_case to camelCase for consistency
  return snakeToCamel(row) as T;
}

// MySQL-specific helper: Update and return the updated row
export async function updateAndReturn<T extends any>(
  query: any,
  tableName: string,
  whereClause: string,
  params: any[]
): Promise<T | null> {
  await query;
  
  // Convert params to safe SQL values
  const safeParams = params.map(p => {
    if (typeof p === 'string') return `'${p.replace(/'/g, "''")}'`;
    if (p === null) return 'NULL';
    return p;
  });
  
  // Replace placeholders with actual values
  let sqlQuery = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
  safeParams.forEach(param => {
    sqlQuery = sqlQuery.replace('?', param.toString());
  });
  
  const rows = await db.execute(sql.raw(sqlQuery));
  const row = rows[0]?.[0];
  // Convert snake_case to camelCase for consistency
  return row ? snakeToCamel(row) as T : null;
}

// MySQL-specific helper: Insert and return within a transaction
export async function insertAndReturnTx<T extends any>(
  query: any,
  tx: any,
  tableName: string
): Promise<T> {
  const result = await query;
  const insertId = result[0].insertId;
  const rows = await tx.execute(sql.raw(`SELECT * FROM ${tableName} WHERE id = ${insertId}`));
  const row = rows[0][0];
  // Convert snake_case to camelCase for consistency
  return snakeToCamel(row) as T;
}
