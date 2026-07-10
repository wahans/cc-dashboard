import fs from 'node:fs/promises'
import path from 'node:path'
import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const root = process.cwd()
const files = [
  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_sync_log.sql',
  'supabase/seeds/001_cards.sql',
  'supabase/seeds/002_benefits.sql',
]

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    for (const relative of files) {
      process.stdout.write(`Applying ${relative}... `)
      const sql = await fs.readFile(path.join(root, relative), 'utf8')
      await pool.query(sql)
      console.log('ok')
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
