import { describe, it, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VaultProvider } from '../src/vault';
import { AppShell } from '../src/ui/App';
import { periodPdf, partyPdf } from '../src/report';
import { emptyData } from '../src/engine/ledger';

const boot = () => render(<VaultProvider><AppShell /></VaultProvider>);
async function addTxn(u: ReturnType<typeof userEvent.setup>, kind: string, amount: string) {
  await u.click(screen.getByLabelText('Add transaction')); const dlg = await screen.findByRole('dialog');
  await u.click(within(dlg).getByRole('button', { name: kind })); await u.type(within(dlg).getByPlaceholderText('0'), amount);
  await u.click(within(dlg).getByRole('button', { name: /^Add transaction$/ })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}
describe('app', () => {
  it('starts, records income + expense, updates dashboard and survives a restart', async () => {
    const u = userEvent.setup(); const { unmount } = boot(); await screen.findByText('Total cash balance');
    await addTxn(u, 'Income', '1500.50'); await addTxn(u, 'Expense', '400');
    await waitFor(() => expect(document.querySelector('.hero .big')!.textContent).toBe('₹1,100.50'));
    unmount(); boot(); await screen.findByText('Total cash balance'); expect(document.querySelector('.hero .big')!.textContent).toBe('₹1,100.50'); // persisted
  });
  it('rejects empty amounts with a clear message', async () => {
    const u = userEvent.setup(); boot(); await screen.findByText('Total cash balance'); await u.click(screen.getByLabelText('Add transaction'));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add transaction' })); expect((await screen.findByRole('alert')).textContent).toMatch(/amount greater than zero/);
  });
  it('edits and deletes from the list, and navigates every tab', async () => {
    const u = userEvent.setup(); boot(); await screen.findByText('Total cash balance'); await addTxn(u, 'Income', '100');
    for (const t of ['Transactions', 'Parties', 'Insights', 'Settings', 'Home']) { await u.click(within(screen.getByRole('navigation')).getByRole('button', { name: t })); }
    await u.click(await screen.findByText(/^Income/, { selector: '.tx .mid span' })); const dlg = await screen.findByRole('dialog');
    await u.click(within(dlg).getByRole('button', { name: 'Delete transaction' })); await u.click(within(dlg).getByRole('button', { name: /Tap again/ }));
    await waitFor(() => expect(document.querySelector('.hero .big')!.textContent).toBe('₹0'));
  });
  it('customer credit sale then payment settles the ledger', async () => {
    const u = userEvent.setup(); boot(); await screen.findByText('Total cash balance');
    await u.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Parties' })); await u.click(screen.getByLabelText('Add party'));
    await u.type(await screen.findByLabelText('Name'), 'Asha'); await u.click(screen.getByRole('button', { name: 'Save' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await u.click(await screen.findByText('Asha')); await u.click(screen.getByRole('button', { name: 'Credit sale' })); const dlg = await screen.findByRole('dialog');
    await u.click(within(dlg).getByRole('button', { name: 'Asha' })); await u.type(within(dlg).getByPlaceholderText('0'), '750'); await u.click(within(dlg).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(screen.getByText('Outstanding to receive').nextSibling!.textContent).toBe('₹750'));
    await u.click(screen.getByRole('button', { name: 'Money received' })); const d2 = await screen.findByRole('dialog'); await u.type(within(d2).getByPlaceholderText('0'), '750'); await u.click(within(d2).getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(screen.getByText('Outstanding to receive').nextSibling!.textContent).toBe('₹0'));
  });
});
describe('pdf', () => { it('generates valid PDFs', () => { const b = atob(periodPdf(emptyData(), '2026-11-01', '2026-11-30', 'Monthly')); expect(b.startsWith('%PDF-')).toBe(true); expect(b.length).toBeGreaterThan(1000);
  const d = emptyData(); d.parties.push({ id: 'p', kind: 'customer', name: 'A', opening: 100 }); expect(atob(partyPdf(d, d.parties[0])).startsWith('%PDF-')).toBe(true); }); });
