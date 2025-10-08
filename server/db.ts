import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
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
  db = drizzleMysql(poolConnection, { schema, mode: 'default' });
  pool = poolConnection;
} else {
  // PostgreSQL connection
  // Check if using serverless Neon (has specific domains) or regular PostgreSQL
  const isNeonServerless = config.database.url.includes('neon.tech') || 
                           config.database.url.includes('neon.database') ||
                           config.database.url.includes('.replit.dev');
  
  if (isNeonServerless) {
    // Use serverless Neon with WebSocket for Neon databases
    neonConfig.webSocketConstructor = ws;
    const neonPool = new NeonPool({ connectionString: config.database.url });
    db = drizzleNeon(neonPool, { schema });
    pool = neonPool;
  } else {
    // Use regular node-postgres for standard PostgreSQL (localhost or other servers)
    const pgPool = new PgPool({ 
      connectionString: config.database.url,
      ssl: false
    });
    db = drizzlePg(pgPool, { schema });
    pool = pgPool;
  }
}

export { db, pool };
