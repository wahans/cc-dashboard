import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import type { SyncLogRow } from '@/types/sync'

export type { SyncLogRow }

export async function GET() {
  const rows = await sql`
    select id, type, ran_at, records_processed, records_updated, error
    from sync_log order by ran_at desc limit 20
  `
  return NextResponse.json({ rows })
}
