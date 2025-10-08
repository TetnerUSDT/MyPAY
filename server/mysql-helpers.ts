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
): Promise<T> {
  if (isMySQL()) {
    await query;
    const whereValue = params[0];
    const rows = await db.execute(sql.raw(`SELECT * FROM ${tableName} WHERE ${whereClause.replace('?', whereValue)}`));
    return rows[0][0] as T;
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
