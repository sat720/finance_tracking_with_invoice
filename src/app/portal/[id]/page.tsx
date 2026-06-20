'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface InvoiceItem {
  id: string;
  description: string;
  totalAmount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
  issueDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  items: InvoiceItem[];
}

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  date: string;
  description: string;
  invoice?: { invoiceNumber: string } | null;
}

interface Contact {
  id: string;
  type: 'CLIENT' | 'VENDOR';
  name: string;
  email: string;
  phone: string;
  billingAddress: string;
  gstin: string;
  state: string;
  invoices: Invoice[];
  transactions: Transaction[];
}

const getCurrencySymbol = (currency?: string) => {
  if (currency === 'USD') return '$ ';
  if (currency === 'EUR') return '€ ';
  if (currency === 'GBP') return '£ ';
  return 'Rs. ';
};

export default function PortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const res = await fetch(`/api/portal/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch portal details');
      }
      setContact(data.contact);
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const handlePayInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to process payment for this invoice?')) return;
    setPayingInvoiceId(invoiceId);
    try {
      const res = await fetch(`/api/portal/invoice/${invoiceId}/pay`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Payment failed');
      }
      alert('Payment simulated successfully! Ledger updated.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error executing payment');
    } finally {
      setPayingInvoiceId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#09070f', color: '#fff' }}>
        <div className="logo-icon" style={{ animation: 'spin 1.5s linear infinite', width: 40, height: 40 }}>VC</div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#09070f', color: '#fff', gap: '20px' }}>
        <h2 style={{ color: 'var(--danger)' }}>Portal Link Expired or Invalid</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error || 'No contact matches this registration record.'}</p>
        <Link href="/login" className="btn btn-primary">Return to login</Link>
      </div>
    );
  }

  const isClient = contact.type === 'CLIENT';

  // Calculations
  const invoices = contact.invoices || [];
  
  // Filter out DRAFT invoices for clients/vendors (they only see SENT, OVERDUE, PAID)
  const visibleInvoices = invoices.filter(inv => inv.status !== 'DRAFT');

  // Compute Outstanding & Completed (in INR for uniform base comparison, or using original currency if single currency)
  // Let's compute both in INR and local currency equivalents.
  // For client: Outstanding represents how much they owe us.
  // For vendor: Outstanding represents how much we owe them.
  const outstandingInvoices = visibleInvoices.filter(inv => inv.status === 'SENT' || inv.status === 'OVERDUE');
  const paidInvoices = visibleInvoices.filter(inv => inv.status === 'PAID');

  const totalOutstandingINR = outstandingInvoices.reduce((sum, inv) => {
    const amt = inv.items.reduce((acc, i) => acc + i.totalAmount, 0);
    return sum + (amt * (inv.exchangeRate || 1.0));
  }, 0);

  const totalPaidINR = paidInvoices.reduce((sum, inv) => {
    const amt = inv.items.reduce((acc, i) => acc + i.totalAmount, 0);
    return sum + (amt * (inv.exchangeRate || 1.0));
  }, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#09070f', color: '#fff', padding: '40px 20px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* Portal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="logo-icon" style={{ width: '42px', height: '42px', fontSize: '20px' }}>VC</div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>Business Finance Portal</h1>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Settle invoices & review statements with Vriddhi Capital</p>
            </div>
          </div>
          <Link href="/login" className="btn btn-secondary btn-sm" style={{ padding: '8px 16px' }}>
            Sign In as Administrator
          </Link>
        </div>

        {/* Contact Details and Summary Card Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
          
          {/* Business Details Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Your Business Profile</h2>
              <span style={{
                background: isClient ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: isClient ? 'var(--success)' : 'var(--danger)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: '4px'
              }}>
                {contact.type}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Company Name:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contact.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>GSTIN Identifier:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{contact.gstin}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>State Location:</span>
                <span style={{ fontWeight: 600 }}>{contact.state}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Registered Email:</span>
                <span>{contact.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone Number:</span>
                <span>{contact.phone}</span>
              </div>
              <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Billing Address:</span>
                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>{contact.billingAddress}</span>
              </div>
            </div>
          </div>

          {/* Quick Ledger Balance Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Dues Summary</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  {isClient ? 'Total Outstanding Amount Owed' : 'Total Outstanding Bills Due'}
                </span>
                <span style={{ fontSize: '32px', fontWeight: 700, color: totalOutstandingINR > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  Rs. {totalOutstandingINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total Paid/Settled (All-Time)</span>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--success)' }}>
                    Rs. {totalPaidINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Invoices Transacted</span>
                  <span style={{ fontSize: '16px', fontWeight: 600 }}>{visibleInvoices.length} Invoices</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices Ledger Table Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Outstanding & Historical Invoices</h2>
          
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 8px' }}>Invoice No</th>
                  <th style={{ padding: '12px 8px' }}>Issue Date</th>
                  <th style={{ padding: '12px 8px' }}>Due Date</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Billed Amount</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No bills or invoices currently registered.
                    </td>
                  </tr>
                ) : (
                  visibleInvoices.map((inv) => {
                    const billAmount = inv.items.reduce((sum, item) => sum + item.totalAmount, 0);
                    const isUnpaid = inv.status === 'SENT' || inv.status === 'OVERDUE';
                    
                    // Status styling config
                    let statusColor = 'var(--text-muted)';
                    let statusBg = 'rgba(255, 255, 255, 0.05)';
                    if (inv.status === 'PAID') {
                      statusColor = 'var(--success)';
                      statusBg = 'rgba(16, 185, 129, 0.1)';
                    } else if (inv.status === 'OVERDUE') {
                      statusColor = 'var(--danger)';
                      statusBg = 'rgba(239, 68, 68, 0.1)';
                    } else if (inv.status === 'SENT') {
                      statusColor = 'var(--info)';
                      statusBg = 'rgba(6, 182, 212, 0.1)';
                    }

                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '16px 8px', fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>{new Date(inv.issueDate).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: 600 }}>
                          {getCurrencySymbol(inv.currency)}{billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {inv.currency !== 'INR' && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                              ≈ Rs. {(billAmount * (inv.exchangeRate || 1.0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                          <span style={{
                            color: statusColor,
                            background: statusBg,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {isUnpaid && (
                              <button
                                onClick={() => handlePayInvoice(inv.id)}
                                disabled={payingInvoiceId === inv.id}
                                className="btn btn-primary btn-sm"
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  background: 'var(--success)',
                                  borderColor: 'var(--success)'
                                }}
                              >
                                {payingInvoiceId === inv.id ? 'Settling...' : 'Simulate Payment'}
                              </button>
                            )}
                            <a
                              href={`/invoice-print/${inv.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '5px 12px', fontSize: '12px' }}
                            >
                              Print / PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments & Transactions History Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Payment & Settlement History</h2>
          
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 8px' }}>Date</th>
                  <th style={{ padding: '12px 8px' }}>Type</th>
                  <th style={{ padding: '12px 8px' }}>Category</th>
                  <th style={{ padding: '12px 8px' }}>Description</th>
                  <th style={{ padding: '12px 8px' }}>Linked Invoice</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(contact.transactions || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No payment or settlement records logged yet.
                    </td>
                  </tr>
                ) : (
                  (contact.transactions || []).map((tx) => {
                    const isIncoming = tx.type === 'INCOME';
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '16px 8px' }}>
                          <span style={{
                            color: isIncoming ? 'var(--success)' : 'var(--danger)',
                            background: isIncoming ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700
                          }}>
                            {isIncoming ? (isClient ? 'PAYMENT RECEIVED' : 'RECEIPT FROM US') : (isClient ? 'REFUND' : 'PAYMENT SENT')}
                          </span>
                        </td>
                        <td style={{ padding: '16px 8px', fontWeight: 500, textTransform: 'capitalize' }}>
                          {tx.category.toLowerCase().replace(/_/g, ' ')}
                        </td>
                        <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>{tx.description}</td>
                        <td style={{ padding: '16px 8px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                          {tx.invoice ? tx.invoice.invoiceNumber : <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>Direct Entry</span>}
                        </td>
                        <td style={{
                          padding: '16px 8px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: isIncoming ? 'var(--success)' : 'var(--danger)',
                          fontSize: '14px'
                        }}>
                          {isIncoming ? '+' : '-'} Rs. {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
