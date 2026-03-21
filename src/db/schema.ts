import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sagePath: text('sage_path').notNull().unique(),
  name: text('name').notNull(),
  isConnected: integer('is_connected', { mode: 'boolean' }).notNull().default(false),
  connectedAt: integer('connected_at', { mode: 'timestamp' }),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id),
  sageTxRef: text('sage_tx_ref').notNull(),
  txDate: integer('tx_date', { mode: 'timestamp' }).notNull(),
  reference: text('reference'),
  description: text('description'),
  amountPence: integer('amount_pence').notNull(),
  txType: text('tx_type'),
  importedAt: integer('imported_at', { mode: 'timestamp' }).notNull(),
});
