import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from "@workspace/db/schema";
import { config } from "./config";

if (!config.database.url) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// MySQL connection pool
const pool = mysql.createPool(config.database.url);

// Initialize Drizzle with MySQL
const db = drizzle(pool, { schema, mode: 'default' });

export { db, pool };
