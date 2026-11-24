/**
 * Run Supabase migration directly against remote database
 * Usage: node scripts/run-migration.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

// Database connection string from environment variable (never hardcode passwords)
// Format: postgresql://postgres:<password>@db.nouhpswnhooizhexjzgx.supabase.co:5432/postgres
const CONNECTION_STRING =
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:REPLACE_WITH_PASSWORD@db.nouhpswnhooizhexjzgx.supabase.co:5432/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function runMigration() {
  console.log('🔌 Connecting to Supabase database...');

  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully');

    // Read migration file
    const migrationPath = join(
      projectRoot,
      'supabase',
      'migrations',
      '20261113205201_init_courses_module.sql'
    );
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded, executing...');
    console.log('─'.repeat(60));

    // Execute the entire migration as a single transaction
    await client.query('BEGIN');

    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('─'.repeat(60));
      console.log('✅ Migration executed successfully!');

      // Verify tables were created
      console.log('\n📋 Verifying tables...');
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('courses', 'course_modules', 'lessons', 'lesson_resources')
        ORDER BY table_name
      `);

      console.log('Tables found:');
      tables.rows.forEach((row) => console.log(`  - ${row.table_name}`));

      // Verify enums
      const enums = await client.query(`
        SELECT typname
        FROM pg_type
        WHERE typname IN ('course_status', 'lesson_video_provider')
      `);

      console.log('\nEnums found:');
      enums.rows.forEach((row) => console.log(`  - ${row.typname}`));

      // Verify functions
      const functions = await client.query(`
        SELECT proname
        FROM pg_proc
        WHERE proname IN ('is_super_admin', 'is_admin', 'sync_course_status', 'set_updated_at')
      `);

      console.log('\nFunctions found:');
      functions.rows.forEach((row) => console.log(`  - ${row.proname}`));

      // Verify RLS policies
      const policies = await client.query(`
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('courses', 'course_modules', 'lessons', 'lesson_resources')
        ORDER BY tablename, policyname
      `);

      console.log('\nRLS Policies:');
      let currentTable = '';
      policies.rows.forEach((row) => {
        if (row.tablename !== currentTable) {
          currentTable = row.tablename;
          console.log(`\n  ${row.tablename}:`);
        }
        console.log(`    - ${row.policyname}`);
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed');
  }
}

runMigration();
