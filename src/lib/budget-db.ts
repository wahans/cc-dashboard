import { neon } from '@neondatabase/serverless'

export type BudgetTransaction = {
  id: string
  date: Date
  amount: number      // positive float, dollars
  description: string
  type: 'DEBIT' | 'CREDIT'
}

export async function getAmexTransactions(): Promise<BudgetTransaction[]> {
  const sql = neon(process.env.BUDGET_DATABASE_URL!)
  const rows = await sql`
    SELECT t.id, t.date, t.amount, t.description
    FROM "Transaction" t
    JOIN "PlaidAccount" a ON t."accountId" = a.id
    WHERE a."accountName" = 'Amex Platinum Card'
      AND t.type IN ('DEBIT', 'CREDIT')
      AND t.hidden = false
    ORDER BY t.date ASC
  `
  return rows as BudgetTransaction[]
}
