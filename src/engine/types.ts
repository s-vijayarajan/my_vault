export type TxKind = 'income' | 'expense' | 'received' | 'paid' | 'credit_sale' | 'credit_purchase' | 'transfer';
export interface Account { id: string; name: string; type: 'cash' | 'bank'; opening: number; }
export interface Party { id: string; kind: 'customer' | 'supplier'; name: string; phone?: string; opening: number; }
export interface Tx {
  id: string; date: string; kind: TxKind; amount: number; accountId?: string; toAccountId?: string;
  partyId?: string; category: string; note: string; recurringId?: string; createdAt: number;
}
export interface Recurring {
  id: string; kind: 'income' | 'expense'; amount: number; accountId: string; category: string; note: string;
  freq: 'daily' | 'weekly' | 'monthly'; start: string; end?: string; active: boolean;
}
export interface Budget { id: string; category: string; limit: number; }
export interface Settings {
  businessName: string; ownerName: string; dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  theme: 'light' | 'dark' | 'system'; pinHash?: string; pinSalt?: string; biometric: boolean;
  savingsTarget: number; expenseLimit: number; lastAccountId?: string; lastBackupAt?: number;
}
export interface Data {
  accounts: Account[]; parties: Party[]; txs: Tx[]; recurring: Recurring[]; budgets: Budget[]; settings: Settings;
}
export const DEFAULT_SETTINGS: Settings = {
  businessName: 'My Business', ownerName: '', dateFormat: 'DD/MM/YYYY', theme: 'system', biometric: false,
  savingsTarget: 0, expenseLimit: 0,
};
export const EXPENSE_CATEGORIES = ['Rent', 'Salary', 'Utilities', 'Inventory', 'Transport', 'Food', 'Marketing', 'Taxes', 'Other'];
export const INCOME_CATEGORIES = ['Sales', 'Services', 'Interest', 'Other'];
