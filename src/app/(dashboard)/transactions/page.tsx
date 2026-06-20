'use client';

import { useEffect, useState, useRef } from 'react';

interface Contact {
  id: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  date: string;
  description: string;
  contactId: string | null;
  invoiceId: string | null;
  receiptUrl: string | null;
  contact?: Contact | null;
  invoice?: any | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [userRole, setUserRole] = useState<string>('VIEWER');

  // Filters
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Form states
  const [formType, setFormType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formContactId, setFormContactId] = useState('');
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formError, setFormError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = {
    INCOME: ['PRODUCT_SALES', 'SERVICES', 'OTHER_INCOME'],
    EXPENSE: ['SALARIES', 'RENT', 'MARKETING', 'UTILITIES', 'VENDOR_PAYMENTS', 'OTHER'],
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, txRes, contactsRes, invoicesRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/transactions'),
          fetch('/api/contacts'),
          fetch('/api/invoices'),
        ]);

        const meData = await meRes.json();
        const txData = await txRes.json();
        const contactsData = await contactsRes.json();
        const invoicesData = await invoicesRes.json();

        setUserRole(meData.user?.role || 'VIEWER');
        setTransactions(txData.transactions || []);
        setContacts(contactsData.contacts || []);
        setInvoices(invoicesData.invoices || []);
      } catch (e) {
        console.error('Failed to load transaction data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Update default category when type changes
  useEffect(() => {
    if (!editingTx) {
      setFormCategory(categories[formType][0]);
    }
  }, [formType]);

  const openCreateModal = () => {
    setEditingTx(null);
    setFormType('INCOME');
    setFormCategory(categories.INCOME[0]);
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setFormContactId('');
    setFormInvoiceId('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setFormType(tx.type);
    setFormCategory(tx.category);
    setFormAmount(tx.amount.toString());
    setFormDate(new Date(tx.date).toISOString().split('T')[0]);
    setFormDescription(tx.description);
    setFormContactId(tx.contactId || '');
    setFormInvoiceId(tx.invoiceId || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setFormError('');

    if (isNaN(parseFloat(formAmount)) || parseFloat(formAmount) <= 0) {
      setFormError('Please enter a valid amount');
      setSubmitLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('type', formType);
    formData.append('category', formCategory);
    formData.append('amount', formAmount);
    formData.append('date', formDate);
    formData.append('description', formDescription);
    if (formContactId) {
      formData.append('contactId', formContactId);
    }
    if (formInvoiceId) {
      formData.append('invoiceId', formInvoiceId);
    }
    
    // Check file upload
    if (fileInputRef.current?.files?.[0]) {
      formData.append('receipt', fileInputRef.current.files[0]);
    }

    try {
      const url = editingTx ? `/api/transactions/${editingTx.id}` : '/api/transactions';
      const method = editingTx ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData, // Natively handles multipart/form-data for file uploads
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save transaction');
      }

      // Refresh list
      const txRes = await fetch('/api/transactions');
      const txData = await txRes.json();
      setTransactions(txData.transactions || []);

      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving transaction');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction record?')) {
      return;
    }

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete transaction');
      }

      setTransactions(transactions.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredTx = transactions.filter((tx) => {
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    if (filterCategory && tx.category !== filterCategory) return false;
    return true;
  });

  // Filter contacts by formType
  const formContacts = contacts.filter((c) => {
    if (formType === 'INCOME') return c.type === 'CLIENT';
    return c.type === 'VENDOR';
  });

  const eligibleInvoices = invoices.filter(inv => inv.clientId === formContactId);

  return (
    <div>
      <div className="header-container">
        <div className="page-title-container">
          <h1 className="page-title">Ledger Transactions</h1>
          <p className="page-subtitle">Unified ledger for income and expense logs with category tags and receipts</p>
        </div>

        <button 
          onClick={openCreateModal} 
          className="btn btn-primary no-print"
          disabled={userRole === 'VIEWER'}
          title={userRole === 'VIEWER' ? "Viewer: Read-Only" : undefined}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
          {userRole === 'VIEWER' ? 'Record Entry (Viewer: Read-Only)' : 'Record Entry'}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }} className="no-print">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => { setFilterType('ALL'); setFilterCategory(''); }} 
            className={`btn ${filterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Ledger
          </button>
          <button 
            onClick={() => { setFilterType('INCOME'); setFilterCategory(''); }} 
            className={`btn ${filterType === 'INCOME' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Income (Inflow)
          </button>
          <button 
            onClick={() => { setFilterType('EXPENSE'); setFilterCategory(''); }} 
            className={`btn ${filterType === 'EXPENSE' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Expense (Outflow)
          </button>
        </div>

        <select 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="">Filter by Category</option>
          {filterType === 'INCOME' && categories.INCOME.map(cat => (
            <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
          ))}
          {filterType === 'EXPENSE' && categories.EXPENSE.map(cat => (
            <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
          ))}
          {filterType === 'ALL' && [...categories.INCOME, ...categories.EXPENSE].map(cat => (
            <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Ledger Table */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading ledger...</div>
        ) : filteredTx.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No transaction records match the criteria.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Business / Ledger</th>
                  <th>Linked Invoice</th>
                  <th>Description</th>
                  <th>Receipt</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  {userRole !== 'VIEWER' && <th className="no-print">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((tx) => (
                  <tr 
                    key={tx.id} 
                    onClick={() => { setSelectedTxDetail(tx); setDetailModalOpen(true); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                    <td>
                      <span className={`badge ${tx.type === 'INCOME' ? 'badge-paid' : 'badge-overdue'}`}>
                        {tx.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {tx.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {tx.contact ? tx.contact.name : <span style={{ color: 'var(--text-muted)' }}>Non-associated</span>}
                    </td>
                    <td>
                      {tx.invoice ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                          {tx.invoice.invoiceNumber}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Direct Entry</span>
                      )}
                    </td>
                    <td>{tx.description}</td>
                    <td>
                      {tx.receiptUrl ? (
                        <a 
                          href={tx.receiptUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          onClick={(e) => e.stopPropagation()} 
                          style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline', fontSize: '13px' }}
                        >
                          View Receipt
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No receipt</span>
                      )}
                    </td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontWeight: 600, 
                      color: tx.type === 'INCOME' ? 'var(--success)' : 'var(--danger)',
                      fontSize: '15px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    >
                      {tx.type === 'INCOME' ? '+' : '-'} Rs. {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {userRole !== 'VIEWER' && (
                      <td className="no-print" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => openEditModal(tx)} 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 8px' }}
                          >
                            Edit
                          </button>
                          {userRole === 'FOUNDER' && (
                            <button 
                              onClick={() => handleDelete(tx.id)} 
                              className="btn btn-danger btn-sm"
                              style={{ padding: '6px 8px' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record/Edit Transaction Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                {editingTx ? 'Modify Transaction' : 'Record Transaction Entry'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    color: 'var(--danger)',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginBottom: '16px',
                    textAlign: 'center'
                  }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Transaction Type *</label>
                    <select 
                      value={formType} 
                      onChange={(e) => setFormType(e.target.value as 'INCOME' | 'EXPENSE')}
                      disabled={!!editingTx}
                    >
                      <option value="INCOME">INCOME (Inflow)</option>
                      <option value="EXPENSE">EXPENSE (Outflow)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Category *</label>
                    <select 
                      value={categories[formType].includes(formCategory) ? formCategory : 'CUSTOM'} 
                      onChange={(e) => {
                        if (e.target.value === 'CUSTOM') {
                          setFormCategory('');
                        } else {
                          setFormCategory(e.target.value);
                        }
                      }}
                    >
                      {formType === 'INCOME' 
                        ? categories.INCOME.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)
                        : categories.EXPENSE.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)
                      }
                      <option value="CUSTOM">-- Custom Category --</option>
                    </select>
                  </div>
                </div>

                {(!categories[formType].includes(formCategory) || formCategory === '') && (
                  <div className="form-group">
                    <label htmlFor="customCat">Custom Category Name *</label>
                    <input
                      type="text"
                      id="customCat"
                      value={formCategory.replace(/_/g, ' ')}
                      onChange={(e) => setFormCategory(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                      placeholder="e.g. CONSULTING BONUS"
                      required
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label htmlFor="amount">Amount (Rs.) *</label>
                    <input
                      type="number"
                      id="amount"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="date">Transaction Date *</label>
                    <input
                      type="date"
                      id="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Associate Client/Vendor</label>
                  <select 
                    value={formContactId} 
                    onChange={(e) => {
                      setFormContactId(e.target.value);
                      setFormInvoiceId('');
                    }}
                  >
                    <option value="">Select Account (Optional)</option>
                    {formContacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {formContactId && eligibleInvoices.length > 0 && (
                  <div className="form-group">
                    <label>Link Invoice Payment</label>
                    <select
                      value={formInvoiceId}
                      onChange={(e) => setFormInvoiceId(e.target.value)}
                    >
                      <option value="">Select Invoice to Settle (Optional)</option>
                      {eligibleInvoices.map(inv => {
                        const total = inv.items.reduce((sum: number, i: any) => sum + i.totalAmount, 0);
                        return (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNumber} ({inv.currency} {total.toLocaleString('en-IN', { maximumFractionDigits: 2 })} - {inv.status})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="desc">Description *</label>
                  <input
                    type="text"
                    id="desc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Enter short description"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="receipt">Attach Receipt Image</label>
                  <input
                    type="file"
                    id="receipt"
                    ref={fileInputRef}
                    accept="image/*"
                    style={{ padding: '8px' }}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                    Upload file proof. Keeps existing if left blank during edit.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Saving...' : editingTx ? 'Update Entry' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Transaction Details Inspector Modal */}
      {detailModalOpen && selectedTxDetail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Transaction Audit Details
              </h2>
              <button 
                onClick={() => setDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ color: '#eaeaea', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${selectedTxDetail.type === 'INCOME' ? 'badge-paid' : 'badge-overdue'}`}>
                  {selectedTxDetail.type === 'INCOME' ? 'INFLOW / INCOME' : 'OUTFLOW / EXPENSE'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  ID: {selectedTxDetail.id}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Amount</h4>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: selectedTxDetail.type === 'INCOME' ? 'var(--success)' : 'var(--danger)' }}>
                    Rs. {selectedTxDetail.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Transaction Date</h4>
                  <p style={{ fontSize: '16px', fontWeight: 500, color: 'white' }}>
                    {new Date(selectedTxDetail.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Category</h4>
                  <p style={{ fontSize: '15px', fontWeight: 500, color: 'white', textTransform: 'capitalize' }}>
                    {selectedTxDetail.category.toLowerCase().replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Description</h4>
                  <p style={{ fontSize: '15px', fontWeight: 500, color: 'white' }}>
                    {selectedTxDetail.description}
                  </p>
                </div>
              </div>

              {/* Linked Contact */}
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>Associated Contact Account</h4>
                {selectedTxDetail.contact ? (
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px' }}>
                    <p style={{ fontWeight: 600, color: 'white', fontSize: '14px' }}>{selectedTxDetail.contact.name}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      <div>Type: {selectedTxDetail.contact.type}</div>
                      <div>State: {selectedTxDetail.contact.state || '-'}</div>
                      <div>GSTIN: {selectedTxDetail.contact.gstin || 'Unregistered'}</div>
                      <div>Email: {selectedTxDetail.contact.email || '-'}</div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No client/vendor account associated with this transaction record.
                  </p>
                )}
              </div>

              {/* Linked Invoice */}
              <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>Linked Tax Invoice</h4>
                {selectedTxDetail.invoice ? (
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
                        {selectedTxDetail.invoice.invoiceNumber}
                      </span>
                      <span className={`badge badge-${selectedTxDetail.invoice.status.toLowerCase()}`}>
                        {selectedTxDetail.invoice.status}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      <div>Issue Date: {new Date(selectedTxDetail.invoice.issueDate).toLocaleDateString('en-IN')}</div>
                      <div>Due Date: {new Date(selectedTxDetail.invoice.dueDate).toLocaleDateString('en-IN')}</div>
                      {selectedTxDetail.invoice.eInvoiceRef && (
                        <div style={{ gridColumn: 'span 2', fontFamily: 'monospace' }}>IRN: {selectedTxDetail.invoice.eInvoiceRef}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No invoice associated. Added via direct ledger entry or bank statement import.
                  </p>
                )}
              </div>

              {/* Receipt File */}
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>Receipt Proof</h4>
                {selectedTxDetail.receiptUrl ? (
                  <div style={{ border: '1px solid var(--border-glass)', borderRadius: '8px', overflow: 'hidden', maxHeight: '200px', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                    <img 
                      src={selectedTxDetail.receiptUrl} 
                      alt="Receipt Attachment" 
                      style={{ maxHeight: '200px', objectFit: 'contain', width: 'auto' }} 
                    />
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No receipt file uploaded.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setDetailModalOpen(false)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
