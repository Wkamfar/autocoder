/**
 * Database Seed Data
 * 
 * Development seed data for testing
 * DO NOT USE IN PRODUCTION
 */

import { getDatabase } from './connection';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

export async function seedDatabase() {
  const db = getDatabase();
  
  logger.info('Starting database seeding...');

  try {
    await db.transaction(async (client) => {
      // Create test organization
      const orgResult = await client.query(
        `INSERT INTO organizations (id, name) 
         VALUES (gen_random_uuid(), $1) 
         ON CONFLICT DO NOTHING
         RETURNING id`,
        ['Test Organization']
      );

      if (orgResult.rows.length === 0) {
        // Organization already exists, get it
        const existingOrg = await client.query(
          'SELECT id FROM organizations WHERE name = $1',
          ['Test Organization']
        );
        orgResult.rows[0] = existingOrg.rows[0];
      }

      const orgId = orgResult.rows[0].id;

      // Create test users
      const passwordHash = await bcrypt.hash('password123', 12);

      const users = [
        {
          email: 'admin@test.com',
          name: 'Admin User',
          role: 'ADMIN',
        },
        {
          email: 'treasury@test.com',
          name: 'Treasury User',
          role: 'TREASURY_INITIATOR',
        },
        {
          email: 'approver@test.com',
          name: 'Approver User',
          role: 'APPROVER',
        },
      ];

      for (const user of users) {
        await client.query(
          `INSERT INTO users (id, org_id, email, password_hash, name, role)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
           ON CONFLICT (email) DO NOTHING`,
          [orgId, user.email, passwordHash, user.name, user.role]
        );
      }

      logger.info('Database seeding completed');
    });
  } catch (error) {
    logger.error('Database seeding failed', { error });
    throw error;
  }
}
