import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Use the fallback Import page after syncing with Lucent.' },
    { status: 410 }
  )
}
