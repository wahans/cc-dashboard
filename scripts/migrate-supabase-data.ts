import { Pool } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sourceUrl = process.env.SUPABASE_SOURCE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

const tables = [
  'cards',
  'card_categories',
  'amex_benefits',
  'benefit_usage',
  'amex_offers',
  'enrolled_offers',
  'sync_log',
]

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

async function fetchTable(table: string): Promise<Record<string, unknown>[]> {
  if (!sourceUrl || !serviceKey) throw new Error('SUPABASE_SOURCE_URL and SUPABASE_SOURCE_SERVICE_ROLE_KEY are required')

  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${sourceUrl}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Range: `${offset}-${offset + 999}`,
      },
    })
    if (!response.ok) throw new Error(`${table}: Supabase returned ${response.status} ${await response.text()}`)
    const page = await response.json() as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

async function copyTable(pool: Pool, table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    console.log(`${table}: 0 rows`)
    return
  }

  const columns = Object.keys(rows[0])
  const columnSql = columns.map(quoteIdentifier).join(', ')
  const updateSql = columns
    .filter((column) => column !== 'id')
    .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
    .join(', ')

  for (const row of rows) {
    const values = columns.map((column) => row[column] ?? null)
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
    await pool.query(
      `insert into ${quoteIdentifier(table)} (${columnSql}) values (${placeholders})
       on conflict ("id") do update set ${updateSql}`,
      values,
    )
  }
  console.log(`${table}: ${rows.length} rows`)
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    for (const table of tables) {
      await copyTable(pool, table, await fetchTable(table))
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
