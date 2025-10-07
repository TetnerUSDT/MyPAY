import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import ws from "ws";
import * as schema from "@shared/schema";
import { config } from "./config";

if (!config.database.url) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let db: any;
let pool: any;

if (config.database.type === 'mysql') {
  // MySQL connection
  const poolConnection = mysql.createPool(config.database.url);
  db = drizzleMysql({ client: poolConnection, schema, mode: 'default' });
  pool = poolConnection;
} else {
  // PostgreSQL (Neon) connection
  neonConfig.webSocketConstructor = ws;
  const neonPool = new Pool({ connectionString: config.database.url });
  db = drizzleNeon({ client: neonPool, schema });
  pool = neonPool;
}

export { db, pool };
