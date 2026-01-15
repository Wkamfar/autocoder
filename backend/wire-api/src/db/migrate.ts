/**
 * Database Migration Runner
 * 
 * Simple migration system that executes SQL files in order
 * Tracks migrations in a migrations table
 */

import { getDatabase } from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

export async function runMigrations() {
  const db = getDatabase();
  
  // Create migrations table if it doesn't exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Get list of executed migrations
  const executedMigrations = await db.query<Migration>(
    'SELECT * FROM migrations ORDER BY id'
  );
  const executedNames = new Set(executedMigrations.rows.map(m => m.name));

  // Find migration files (simple approach - in production use a proper migration tool)
  const migrationsDir = join(__dirname, 'migrations');
  const migrationFiles = [
    '001_initial_schema.sql',
    // Add more migrations here as they are created
  ];

  // For initial migration, load the full schema
  if (!executedNames.has('001_initial_schema.sql')) {
    try {
      logger.info('Running initial schema migration');
      const schemaPath = join(__dirname, 'schema.sql');
      const schemaSQL = readFileSync(schemaPath, 'utf-8');
      
      // Execute schema in a transaction
      await db.transaction(async (client) => {
        await client.query(schemaSQL);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          ['001_initial_schema.sql']
        );
      });

      logger.info('Initial schema migration completed');
    } catch (error) {
      logger.error('Initial schema migration failed', { error });
      throw error;
    }
  }

  // Process other migration files
  for (const fileName of migrationFiles) {
    if (fileName === '001_initial_schema.sql' || executedNames.has(fileName)) {
      if (fileName !== '001_initial_schema.sql') {
        logger.info(`Migration already executed: ${fileName}`);
      }
      continue;
    }

    try {
      logger.info(`Running migration: ${fileName}`);
      const migrationPath = join(migrationsDir, fileName);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // Execute migration in a transaction
      await db.transaction(async (client) => {
        await client.query(migrationSQL);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [fileName]
        );
      });

      logger.info(`Migration completed: ${fileName}`);
    } catch (error) {
      logger.error(`Migration failed: ${fileName}`, { error });
      throw error;
    }
  }

  logger.info('All migrations completed');
}
