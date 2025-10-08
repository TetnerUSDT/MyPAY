import { db } from './db';
import { isMySQL } from './config';
import { sql } from 'drizzle-orm';

export async function insertAndReturn<T extends any>(
  query: any,
  tableName: string
): Promise<T> {
  if (isMySQL()) {
    const result = await query;
    const insertId = result[0].insertId;
    const rows = await db.execute(sql.raw(`SELECT * FROM ${tableName} WHERE id = ${insertId}`));
    return rows[0][0] as T;
  } else {
    const [row] = await query.returning();
    return row as T;
  }
}

export async function updateAndReturn<T extends any>(
  query: any,
  tableName: string,
  whereClause: string,
  params: any[]
): Promise<T | null> {
  if (isMySQL()) {
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
    return rows[0]?.[0] as T || null;
  } else {
    const [row] = await query.returning();
    return row as T;
  }
}

export async function insertAndReturnTx<T extends any>(
  query: any,
  tx: any,
  tableName: string
): Promise<T> {
  if (isMySQL()) {
    const result = await query;
    const insertId = result[0].insertId;
    const rows = await tx.execute(sql.raw(`SELECT * FROM ${tableName} WHERE id = ${insertId}`));
    return rows[0][0] as T;
  } else {
    const [row] = await query.returning();
    return row as T;
  }
}
