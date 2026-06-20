'use client';

import { useEffect, useState } from 'react';

interface NotificationLog {
  id: string;
  type: string;
  recipient: string;
  channel: 'EMAIL' | 'WHATSAPP';
  status: string;
  message: string;
  timestamp: string;
}

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  date: string;
  description: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  client: { name: string };
  items: Array<{ totalAmount: number }>;
}

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<'NOTIFICATIONS' | 'OVERRIDE'>('NOTIFICATIONS');
  
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Override forms modal state
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<{ type: 'TX' | 'INV'; id: string; numberOrDesc: string } | null>(null);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [remindersLoading, setRemindersLoading] = useState(false);

  const handleRunReminders = async () => {
    setRemindersLoading(true);
    try {
      const res = await fetch('/api/admin/reminders', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute reminders');
      }

      alert(`Reminders run completed successfully!\nProcessed Overdue Invoices: ${data.processedCount}`);
      
      // Reload logs
      const logsRes = await fetch('/api/admin/logs');
      const logsData = await logsRes.json();
      setLogs(logsData.logs || []);
    } catch (err: any) {
      alert(err.message || 'Failed to run reminders engine');
    } finally {
      setRemindersLoading(false);
    }
  };

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [logsRes, txRes, invRes] = await Promise.all([
          fetch('/api/admin/logs'),
          fetch('/api/transactions'),
          fetch('/api/invoices'),
        ]);

        const logsData = await logsRes.json();
        const txData = await txRes.json();
        const invData = await invRes.json();

        setLogs(logsData.logs || []);
        setTransactions(txData.transactions || []);
        setInvoices(invData.invoices || []);
      } catch (e) {
        console.error('Failed to load admin logs:', e);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const handleOpenOverride = (type: 'TX' | 'INV', id: string, label: string, currentAmount: number) => {
    setOverrideTarget({ type, id, numberOrDesc: label });
    setOverrideAmount(currentAmount.toString());
    setOverrideError('');
    setOverrideModal(true);
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTarget) return;

    setOverrideLoading(true);
    setOverrideError('');
    const amt = parseFloat(overrideAmount);

    if (isNaN(amt) || amt <= 0) {
      setOverrideError('Please enter a valid amount');
      setOverrideLoading(false);
      return;
    }

    try {
      if (overrideTarget.type === 'TX') {
        // Fetch current tx details, override amount, send PUT
        const txRes = await fetch(`/api/transactions/${overrideTarget.id}`);
        const txData = await txRes.json();
        if (!txRes.ok) throw new Error(txData.error || 'Failed to fetch transaction details');

        const res = await fetch(`/api/transactions/${overrideTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...txData.transaction, amount: amt }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to override transaction');
        }
      } else {
        // Invoice override amount: since amount is calculated from items, we override the rate of the first item to match!
        const invRes = await fetch(`/api/invoices/${overrideTarget.id}`);
        const invData = await invRes.json();
        if (!invRes.ok) throw new Error(invData.error || 'Failed to fetch invoice details');

        const items = [...invData.invoice.items];
        if (items.length > 0) {
          // Adjust first item rate, recalculate total
          const subtotalOtherItems = items.slice(1).reduce((sum, it) => sum + it.totalAmount, 0);
          const firstItemGst = items[0].gstRate || 0;
          const targetItemTotal = amt - subtotalOtherItems;
          
          // Total = base * (1 + gstRate/100) -> base = Total / (1 + gstRate/100)
          const newRate = targetItemTotal / (items[0].quantity * (1 + firstItemGst / 100));
          
          items[0].rate = Math.max(0, newRate);
        }

        const res = await fetch(`/api/invoices/${overrideTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...invData.invoice, items }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to override invoice');
        }
      }

      // Reload
      const [txRes, invRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/invoices'),
      ]);
      const txData = await txRes.json();
      const invData = await invRes.json();
      
      setTransactions(txData.transactions || []);
      setInvoices(invData.invoices || []);
      setOverrideModal(false);
    } catch (err: any) {
      setOverrideError(err.message || 'Override failed');
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleOverrideDelete = async (type: 'TX' | 'INV', id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type === 'TX' ? 'transaction' : 'invoice'} record?`)) {
      return;
    }

    try {
      const url = type === 'TX' ? `/api/transactions/${id}` : `/api/invoices/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete record');
      }

      if (type === 'TX') {
        setTransactions(transactions.filter(t => t.id !== id));
      } else {
        setInvoices(invoices.filter(i => i.id !== id));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="header-container">
        <div className="page-title-container">
          <h1 className="page-title">Central Admin Panel</h1>
          <p className="page-subtitle">Founder control board: ledger overrides, automated triggers log & CSV exports</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} className="no-print">
          {/* Reminders engine trigger */}
          <button onClick={handleRunReminders} className="btn btn-secondary" disabled={remindersLoading}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            {remindersLoading ? 'Running engine...' : 'Run Reminders Engine'}
          </button>
          
          {/* CSV export file link */}
          <a href="/api/admin/export" className="btn btn-primary" download style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export Ledger (Tally CSV)
          </a>
        </div>
      </div>

      {/* Admin Panel navigation tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('NOTIFICATIONS')} 
          className={`btn ${activeTab === 'NOTIFICATIONS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Automated Triggers Log
        </button>
        <button 
          onClick={() => setActiveTab('OVERRIDE')} 
          className={`btn ${activeTab === 'OVERRIDE' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Ledger Override & Controls
        </button>
      </div>

      {/* Admin View Contents */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading admin dashboard logs...</div>
      ) : activeTab === 'NOTIFICATIONS' ? (
        
        // Notifications log tab
        <div className="card">
          <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '16px' }}>
            System Communication Logs
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            Shows notifications triggered for invoice deliveries and overdue payment reminders (email and WhatsApp).
          </p>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No communication logs recorded.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Notification Type</th>
                    <th>Recipient</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Logged Message Text</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {log.type === 'INVOICE_DELIVERY' ? 'Invoice Delivery' : 'Overdue Reminder'}
                      </td>
                      <td>{log.recipient}</td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '12px' }}>{log.channel}</span>
                      </td>
                      <td>
                        <span className={`badge ${
                          log.status === 'SUCCESS' ? 'badge-paid' : 
                          log.status === 'SIMULATED' ? 'badge-pending' : 'badge-overdue'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '300px' }}>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (

        // Ledger overrides tab
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Transactions override section */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '14px' }}>
              Override Transactions (Income / Expenses)
            </h3>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Override Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                      <td>{tx.type}</td>
                      <td>{tx.category.replace('_', ' ')}</td>
                      <td>{tx.description}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {tx.amount.toLocaleString('en-IN')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleOpenOverride('TX', tx.id, tx.description, tx.amount)} 
                            className="btn btn-secondary btn-sm"
                          >
                            Edit Amt
                          </button>
                          <button 
                            onClick={() => handleOverrideDelete('TX', tx.id)} 
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices override section */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '14px' }}>
              Override Client/Vendor Invoices
            </h3>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Client / Contact</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Grand Total</th>
                    <th>Override Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const total = inv.items.reduce((sum, item) => sum + item.totalAmount, 0);
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                        <td>{inv.client.name}</td>
                        <td><span className={`badge badge-${inv.status.toLowerCase()}`}>{inv.status}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {total.toLocaleString('en-IN')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => handleOpenOverride('INV', inv.id, inv.invoiceNumber, total)} 
                              className="btn btn-secondary btn-sm"
                            >
                              Edit Amt
                            </button>
                            <button 
                              onClick={() => handleOverrideDelete('INV', inv.id)} 
                              className="btn btn-danger btn-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Override Amount Modal */}
      {overrideModal && overrideTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>
                Override Amount: {overrideTarget.numberOrDesc}
              </h2>
              <button 
                onClick={() => setOverrideModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit}>
              <div className="modal-body">
                {overrideError && (
                  <div style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    color: 'var(--danger)',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginBottom: '16px',
                    textAlign: 'center'
                  }}>
                    {overrideError}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="overAmt">New Target Amount (Rs.) *</label>
                  <input
                    type="number"
                    id="overAmt"
                    value={overrideAmount}
                    onChange={(e) => setOverrideAmount(e.target.value)}
                    step="0.01"
                    placeholder="Enter amount"
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px', display: 'block' }}>
                    {overrideTarget.type === 'INV' 
                      ? 'Note: Overriding invoice total scales the item rates to match.' 
                      : 'Note: Overriding transaction total updates ledger value.'
                    }
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setOverrideModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={overrideLoading}
                >
                  {overrideLoading ? 'Saving Override...' : 'Confirm Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
