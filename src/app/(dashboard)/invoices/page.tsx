'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Contact {
  id: string;
  name: string;
  type: string;
  billingAddress: string;
  gstin: string;
  state: string;
  email: string;
  phone: string;
}

interface InvoiceItem {
  id?: string;
  description: string;
  hsnSacCode: string;
  quantity: number;
  rate: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
  issueDate: string;
  dueDate: string;
  billingAddress: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  eInvoiceRef: string | null;
  notes: string | null;
  client: Contact;
  items: InvoiceItem[];
  currency?: string;
  exchangeRate?: number;
}

const SELLER_STATE = 'Delhi';
const SELLER_GSTIN = '07ABCDE1234F1Z0';

const getCurrencySymbol = (currency?: string) => {
  if (currency === 'USD') return '$ ';
  if (currency === 'EUR') return '€ ';
  if (currency === 'GBP') return '£ ';
  return 'Rs. ';
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [userRole, setUserRole] = useState<string>('VIEWER');

  // Filter status
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'CLIENT' | 'VENDOR'>('CLIENT');

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Form states
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [formClientId, setFormClientId] = useState('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'SENT' | 'PAID'>('DRAFT');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurrenceInterval, setFormRecurrenceInterval] = useState('MONTHLY');
  const [formItems, setFormItems] = useState<Omit<InvoiceItem, 'cgst' | 'sgst' | 'igst' | 'totalAmount'>[]>([
    { description: '', hsnSacCode: '9983', quantity: 1, rate: 0, gstRate: 18 }
  ]);
  const [formCurrency, setFormCurrency] = useState('INR');
  const [formExchangeRate, setFormExchangeRate] = useState('1.0');
  const [formError, setFormError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, invRes, contactsRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/invoices'),
          fetch('/api/contacts'),
        ]);

        const meData = await meRes.json();
        const invData = await invRes.json();
        const contactsData = await contactsRes.json();

        setUserRole(meData.user?.role || 'VIEWER');
        setInvoices(invData.invoices || []);
        
        // Filter clients only
        setContacts((contactsData.contacts || []).filter((c: any) => c.type === 'CLIENT'));
      } catch (e) {
        console.error('Failed to load invoicing data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedClient = contacts.find(c => c.id === formClientId);
  const isSameState = selectedClient ? selectedClient.state.trim().toLowerCase() === SELLER_STATE.toLowerCase() : true;

  // Real-time tax splits computation for UI preview
  const previewSummary = formItems.reduce((acc, item) => {
    const qty = item.quantity || 0;
    const rate = item.rate || 0;
    const gstRate = item.gstRate || 0;
    const base = qty * rate;
    
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isSameState) {
      cgst = base * (gstRate / 2) / 100;
      sgst = base * (gstRate / 2) / 100;
    } else {
      igst = base * gstRate / 100;
    }

    acc.subtotal += base;
    acc.cgst += cgst;
    acc.sgst += sgst;
    acc.igst += igst;
    acc.total += base + cgst + sgst + igst;
    return acc;
  }, { subtotal: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const openCreateForm = () => {
    setEditingInvoice(null);
    setFormClientId('');
    
    // Auto-generate invoice number sequence
    const year = new Date().getFullYear();
    const count = invoices.length + 1;
    setFormInvoiceNumber(`INV-${year}-${count.toString().padStart(4, '0')}`);
    
    setFormStatus('DRAFT');
    setFormIssueDate(new Date().toISOString().split('T')[0]);
    
    const due = new Date();
    due.setDate(due.getDate() + 15); // Default net-15
    setFormDueDate(due.toISOString().split('T')[0]);
    
    setFormNotes('');
    setFormIsRecurring(false);
    setFormRecurrenceInterval('MONTHLY');
    setFormCurrency('INR');
    setFormExchangeRate('1.0');
    setFormItems([{ description: '', hsnSacCode: '998313', quantity: 1, rate: 0, gstRate: 18 }]);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (inv: Invoice) => {
    setEditingInvoice(inv);
    setFormClientId(inv.client.id);
    setFormInvoiceNumber(inv.invoiceNumber);
    setFormStatus(inv.status === 'OVERDUE' ? 'SENT' : inv.status); // Overdue is fallback of Sent
    setFormIssueDate(new Date(inv.issueDate).toISOString().split('T')[0]);
    setFormDueDate(new Date(inv.dueDate).toISOString().split('T')[0]);
    setFormNotes(inv.notes || '');
    setFormIsRecurring(inv.isRecurring);
    setFormRecurrenceInterval(inv.recurrenceInterval || 'MONTHLY');
    setFormCurrency(inv.currency || 'INR');
    setFormExchangeRate((inv.exchangeRate || 1.0).toString());
    setFormItems(inv.items.map(item => ({
      description: item.description,
      hsnSacCode: item.hsnSacCode,
      quantity: item.quantity,
      rate: item.rate,
      gstRate: item.gstRate,
    })));
    setFormError('');
    setFormOpen(true);
  };

  const handleAddItemRow = () => {
    setFormItems([...formItems, { description: '', hsnSacCode: '998313', quantity: 1, rate: 0, gstRate: 18 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleItemFieldChange = (idx: number, field: string, value: any) => {
    const updated = [...formItems];
    (updated[idx] as any)[field] = value;
    setFormItems(updated);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setFormError('');

    if (!formClientId) {
      setFormError('Please select a buyer client');
      setSubmitLoading(false);
      return;
    }

    // Validate items
    for (const item of formItems) {
      if (!item.description.trim()) {
        setFormError('Item description is required');
        setSubmitLoading(false);
        return;
      }
      if (item.quantity <= 0 || item.rate <= 0) {
        setFormError('Item Quantity and Rate must be greater than zero');
        setSubmitLoading(false);
        return;
      }
    }

    const payload = {
      clientId: formClientId,
      invoiceNumber: formInvoiceNumber.trim(),
      status: formStatus,
      issueDate: formIssueDate,
      dueDate: formDueDate,
      notes: formNotes.trim(),
      isRecurring: formIsRecurring,
      recurrenceInterval: formIsRecurring ? formRecurrenceInterval : null,
      currency: formCurrency,
      exchangeRate: parseFloat(formExchangeRate) || 1.0,
      items: formItems,
    };

    try {
      const url = editingInvoice ? `/api/invoices/${editingInvoice.id}` : '/api/invoices';
      const method = editingInvoice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save invoice');
      }

      // Refresh list
      const invRes = await fetch('/api/invoices');
      const invData = await invRes.json();
      setInvoices(invData.invoices || []);

      setFormOpen(false);

      if (!editingInvoice && data.invoice) {
        setCreatedInvoice(data.invoice);
        setSuccessModalOpen(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving invoice');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePayVendorInvoice = async (inv: Invoice) => {
    if (!confirm(`Are you sure you want to mark this vendor invoice ${inv.invoiceNumber} as paid and record an outflow transaction?`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: inv.client.id,
          invoiceNumber: inv.invoiceNumber,
          status: 'PAID',
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          notes: inv.notes || '',
          isRecurring: inv.isRecurring,
          recurrenceInterval: inv.recurrenceInterval,
          currency: inv.currency || 'INR',
          exchangeRate: inv.exchangeRate || 1.0,
          items: inv.items.map(item => ({
            description: item.description,
            hsnSacCode: item.hsnSacCode,
            quantity: item.quantity,
            rate: item.rate,
            gstRate: item.gstRate,
          })),
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to settle vendor invoice');
      }
      
      alert('Vendor invoice paid successfully! Outflow transaction logged.');
      
      // Refresh list
      const invRes = await fetch('/api/invoices');
      const invData = await invRes.json();
      setInvoices(invData.invoices || []);
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerAction = async (id: string, action: 'send' | 'reminder') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}?action=${action}`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send notification');
      }

      alert(data.message || 'Action executed successfully!');
      
      // Refresh
      const invRes = await fetch('/api/invoices');
      const invData = await invRes.json();
      const updatedList = invData.invoices || [];
      setInvoices(updatedList);
      
      // Update selected modal details view
      if (selectedInvoice) {
        const matching = updatedList.find((i: any) => i.id === selectedInvoice.id);
        if (matching) setSelectedInvoice(matching);
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This will also remove any automatic transaction records.')) {
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete invoice');
      }

      setInvoices(invoices.filter(inv => inv.id !== id));
      setDetailOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (inv.client?.type !== typeFilter) return false;
    if (filterStatus === 'ALL') return true;
    return inv.status === filterStatus;
  });

  return (
    <div>
      <div className="header-container">
        <div className="page-title-container">
          <h1 className="page-title">{typeFilter === 'CLIENT' ? 'Customer Invoices' : 'Vendor Bills'}</h1>
          <p className="page-subtitle">
            {typeFilter === 'CLIENT' 
              ? 'GST invoice generator, client billings, status tracking & communications'
              : 'Incoming bills from vendors, expense tracking, and outbound settlements'}
          </p>
        </div>

        {typeFilter === 'CLIENT' && (
          <button 
            onClick={openCreateForm} 
            className="btn btn-primary no-print"
            disabled={userRole === 'VIEWER'}
            title={userRole === 'VIEWER' ? "Viewer: Read-Only" : undefined}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {userRole === 'VIEWER' ? 'Create GST Invoice (Viewer: Read-Only)' : 'Create GST Invoice'}
          </button>
        )}
      </div>

      {/* Client vs Vendor Category Selector Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }} className="no-print">
        <button
          onClick={() => { setTypeFilter('CLIENT'); setFilterStatus('ALL'); }}
          className={`btn ${typeFilter === 'CLIENT' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          Customer Invoices (Receivable)
        </button>
        <button
          onClick={() => { setTypeFilter('VENDOR'); setFilterStatus('ALL'); }}
          className={`btn ${typeFilter === 'VENDOR' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          Vendor Invoices (Payable)
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }} className="no-print">
        {['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`btn ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Invoice Directory */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No invoices recorded under this category.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Client Name</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total (incl. GST)</th>
                  <th className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const totalAmount = inv.items.reduce((sum, item) => sum + item.totalAmount, 0);
                  const isVendorInvoice = inv.client.type === 'VENDOR';

                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {inv.invoiceNumber}
                        {inv.isRecurring && (
                          <span style={{ marginLeft: '6px', fontSize: '9px', background: 'rgba(139, 92, 246, 0.2)', padding: '2px 5px', borderRadius: '3px', color: 'var(--primary)', fontWeight: 'bold' }}>
                            RECURRING
                          </span>
                        )}
                        {isVendorInvoice && (
                          <span style={{ marginLeft: '6px', fontSize: '9px', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 5px', borderRadius: '3px', color: 'var(--warning)', fontWeight: 'bold' }}>
                            PAYABLE
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>{inv.client.name}</td>
                      <td>{new Date(inv.issueDate).toLocaleDateString('en-IN')}</td>
                      <td>{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={`badge badge-${inv.status.toLowerCase()}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '15px' }}>
                        {getCurrencySymbol(inv.currency)}{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="no-print">
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => { setSelectedInvoice(inv); setDetailOpen(true); }}
                            className="btn btn-secondary btn-sm"
                          >
                            Inspect
                          </button>
                          {userRole !== 'VIEWER' && (
                            <button
                              onClick={() => openEditForm(inv)}
                              className="btn btn-secondary btn-sm"
                            >
                              Edit
                            </button>
                          )}
                          {userRole !== 'VIEWER' && isVendorInvoice && (inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                            <button
                              onClick={() => handlePayVendorInvoice(inv)}
                              className="btn btn-primary btn-sm"
                              style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                              disabled={actionLoading}
                            >
                              Pay Vendor
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Details Inspector Modal */}
      {detailOpen && selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Tax Invoice Details: {selectedInvoice.invoiceNumber}
              </h2>
              <button 
                onClick={() => setDetailOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ color: '#eaeaea' }}>
              
              {/* Document Header details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '20px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '6px' }}>Seller Company</h4>
                  <p style={{ fontWeight: 600, color: 'white' }}>Vriddhi Capital</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Delhi, Place of Supply: Delhi</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>GSTIN: {SELLER_GSTIN}</p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '6px' }}>Buyer Client</h4>
                  <p style={{ fontWeight: 600, color: 'white' }}>{selectedInvoice.client.name}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{selectedInvoice.billingAddress}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>GSTIN: {selectedInvoice.client.gstin}</p>
                </div>
              </div>

              {/* Dates and References info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px', fontSize: '13px' }}>
                <div>
                  <strong>Issue Date:</strong> {new Date(selectedInvoice.issueDate).toLocaleDateString('en-IN')}
                </div>
                <div>
                  <strong>Due Date:</strong> {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')}
                </div>
                <div>
                  <strong>Status:</strong> <span className={`badge badge-${selectedInvoice.status.toLowerCase()}`}>{selectedInvoice.status}</span>
                </div>
              </div>

              {/* E-Invoicing Reference */}
              {selectedInvoice.eInvoiceRef && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '12px' }}>
                  <strong style={{ color: 'var(--primary)' }}>Simulated E-Invoice IRN:</strong>
                  <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    {selectedInvoice.eInvoiceRef}
                  </div>
                </div>
              )}

              {/* Items details table */}
              <div className="table-container" style={{ marginBottom: '24px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>HSN/SAC</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>GST %</th>
                      {isSameState ? (
                        <>
                          <th>CGST</th>
                          <th>SGST</th>
                        </>
                      ) : (
                        <th>IGST</th>
                      )}
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>{item.description}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.hsnSacCode}</td>
                        <td>{item.quantity}</td>
                        <td>{getCurrencySymbol(selectedInvoice.currency)}{item.rate.toLocaleString('en-IN')}</td>
                        <td>{item.gstRate}%</td>
                        {isSameState ? (
                          <>
                            <td>{getCurrencySymbol(selectedInvoice.currency)}{item.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>{getCurrencySymbol(selectedInvoice.currency)}{item.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </>
                        ) : (
                          <td>{getCurrencySymbol(selectedInvoice.currency)}{item.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        )}
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {getCurrencySymbol(selectedInvoice.currency)}{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total splits panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '60px', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal (Before Tax):</span>
                  <span style={{ fontWeight: 500 }}>
                    {getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {isSameState ? (
                  <>
                    <div style={{ display: 'flex', gap: '60px', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>CGST Total:</span>
                      <span style={{ fontWeight: 500 }}>
                        {getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.items.reduce((sum, item) => sum + item.cgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '60px', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>SGST Total:</span>
                      <span style={{ fontWeight: 500 }}>
                        {getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.items.reduce((sum, item) => sum + item.sgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '60px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>IGST Total:</span>
                    <span style={{ fontWeight: 500 }}>
                      {getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.items.reduce((sum, item) => sum + item.igst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '60px', fontSize: '18px', fontWeight: 700, color: 'white', marginTop: '6px' }}>
                  <span>Grand Total (incl. GST):</span>
                  <span>
                    {getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.items.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <strong>Notes:</strong> {selectedInvoice.notes}
                </div>
              )}
            </div>

            {/* Modal Controls */}
            <div className="modal-footer no-print" style={{ justifyContent: 'space-between' }}>
              <div>
                {userRole === 'FOUNDER' && (
                  <button 
                    onClick={() => handleDeleteInvoice(selectedInvoice.id)} 
                    className="btn btn-danger"
                  >
                    Delete Invoice
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setDetailOpen(false)} 
                  className="btn btn-secondary"
                >
                  Close
                </button>
                
                {/* Print button opening printable version */}
                <a 
                  href={`/invoice-print/${selectedInvoice.id}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  Print / Save PDF
                </a>

                {selectedInvoice.status !== 'DRAFT' && selectedInvoice.client.type === 'CLIENT' && (
                  <>
                    <button
                      onClick={() => handleTriggerAction(selectedInvoice.id, 'send')}
                      className="btn btn-primary"
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Triggering...' : 'Deliver Invoice'}
                    </button>
                    
                    {selectedInvoice.status === 'OVERDUE' && (
                      <button
                        onClick={() => handleTriggerAction(selectedInvoice.id, 'reminder')}
                        className="btn btn-danger"
                        disabled={actionLoading}
                        style={{ border: 'none' }}
                      >
                        {actionLoading ? 'Sending...' : 'Overdue Reminder'}
                      </button>
                    )}
                  </>
                )}

                {userRole !== 'VIEWER' && selectedInvoice.client.type === 'VENDOR' && (selectedInvoice.status === 'SENT' || selectedInvoice.status === 'OVERDUE') && (
                  <button
                    onClick={async () => {
                      await handlePayVendorInvoice(selectedInvoice);
                      setDetailOpen(false);
                    }}
                    className="btn btn-primary"
                    disabled={actionLoading}
                    style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                  >
                    {actionLoading ? 'Paying...' : 'Pay Vendor / Mark Paid'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Invoice Form Modal */}
      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                {editingInvoice ? 'Edit Tax Invoice' : 'Create GST Tax Invoice'}
              </h2>
              <button 
                onClick={() => setFormOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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

                {/* Client and Invoice Header inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label>Select Buyer Client *</label>
                    <select
                      value={formClientId}
                      onChange={(e) => setFormClientId(e.target.value)}
                      disabled={!!editingInvoice}
                      required
                    >
                      <option value="">Choose client...</option>
                      {contacts.filter(c => c.type === 'CLIENT').map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.state})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="invNo">Invoice Number *</label>
                    <input
                      type="text"
                      id="invNo"
                      value={formInvoiceNumber}
                      onChange={(e) => setFormInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-2026-0001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Status *</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="SENT">SENT (Outstanding)</option>
                      <option value="PAID">PAID</option>
                    </select>
                  </div>
                </div>

                {/* Currency and Exchange Rate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label>Billing Currency *</label>
                    <select
                      value={formCurrency}
                      onChange={(e) => {
                        setFormCurrency(e.target.value);
                        if (e.target.value === 'INR') {
                          setFormExchangeRate('1.0');
                        }
                      }}
                    >
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                    </select>
                  </div>
                  {formCurrency !== 'INR' && (
                    <div className="form-group">
                      <label htmlFor="exchRate">Exchange Rate (1 {formCurrency} to INR) *</label>
                      <input
                        type="number"
                        id="exchRate"
                        value={formExchangeRate}
                        onChange={(e) => setFormExchangeRate(e.target.value)}
                        placeholder="e.g. 83.5"
                        step="0.0001"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Client autofill metadata view */}
                {selectedClient && (
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', display: 'flex', gap: '20px' }}>
                    <div><strong>GSTIN:</strong> {selectedClient.gstin}</div>
                    <div><strong>Place of Supply:</strong> {selectedClient.state} ({isSameState ? 'Intra-state CGST+SGST' : 'Inter-state IGST'})</div>
                  </div>
                )}

                {/* Dates & Recurring */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                  <div className="form-group">
                    <label htmlFor="issue">Issue Date *</label>
                    <input
                      type="date"
                      id="issue"
                      value={formIssueDate}
                      onChange={(e) => setFormIssueDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="due">Due Date *</label>
                    <input
                      type="date"
                      id="due"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', height: '100%', paddingTop: '10px' }}>
                      <input 
                        type="checkbox" 
                        checked={formIsRecurring} 
                        onChange={(e) => setFormIsRecurring(e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      Is Recurring
                    </label>
                  </div>
                  {formIsRecurring && (
                    <div className="form-group">
                      <label>Interval</label>
                      <select
                        value={formRecurrenceInterval}
                        onChange={(e) => setFormRecurrenceInterval(e.target.value)}
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="ANNUALLY">Annually</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Dynamic Line Items Section */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px', marginBottom: '14px' }}>
                    Invoice Line Items
                  </h3>

                  {formItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr 1fr 1.2fr 1fr auto', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        {idx === 0 && <label>Description *</label>}
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemFieldChange(idx, 'description', e.target.value)}
                          placeholder="SaaS platform service"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        {idx === 0 && <label>HSN/SAC</label>}
                        <input
                          type="text"
                          value={item.hsnSacCode}
                          onChange={(e) => handleItemFieldChange(idx, 'hsnSacCode', e.target.value)}
                          placeholder="9983"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        {idx === 0 && <label>Qty *</label>}
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="1"
                          min="1"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        {idx === 0 && <label>Rate *</label>}
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemFieldChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                          placeholder="Rs."
                          min="1"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        {idx === 0 && <label>GST % *</label>}
                        <select
                          value={item.gstRate}
                          onChange={(e) => handleItemFieldChange(idx, 'gstRate', parseInt(e.target.value) || 0)}
                        >
                          <option value="18">18%</option>
                          <option value="12">12%</option>
                          <option value="5">5%</option>
                          <option value="28">28%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItemRow(idx)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '12px', height: '42px', minWidth: '40px' }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '10px' }}
                  >
                    + Add Item Row
                  </button>
                </div>

                {/* Live tax computations drawer */}
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '40px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>Subtotal:</span>
                    <span>Rs. {previewSummary.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {isSameState ? (
                    <>
                      <div style={{ display: 'flex', gap: '40px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>CGST ({formItems[0]?.gstRate / 2 || 9}% average):</span>
                        <span>Rs. {previewSummary.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '40px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>SGST ({formItems[0]?.gstRate / 2 || 9}% average):</span>
                        <span>Rs. {previewSummary.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: '40px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>IGST ({formItems[0]?.gstRate || 18}%):</span>
                      <span>Rs. {previewSummary.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '40px', fontSize: '16px', fontWeight: 700, color: 'white', borderTop: '1px solid var(--border-glass)', paddingTop: '8px', marginTop: '4px' }}>
                    <span>Grand Total:</span>
                    <span>Rs. {previewSummary.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px', marginBottom: 0 }}>
                  <label htmlFor="notes">Terms / Notes</label>
                  <textarea
                    id="notes"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Enter payment instructions, banking details, or notes"
                    rows={2}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Success Options Modal */}
      {successModalOpen && createdInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', padding: '30px', textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 20px'
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'white', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              Invoice Generated Successfully!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              Invoice <strong style={{ fontFamily: 'monospace' }}>{createdInvoice.invoiceNumber}</strong> has been created. What action would you like to perform now?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={async () => {
                  setSuccessModalOpen(false);
                  await handleTriggerAction(createdInvoice.id, 'send');
                  setCreatedInvoice(null);
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', background: 'var(--success)', borderColor: 'var(--success)' }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Delivering...' : '🚀 Deliver Invoice Now'}
              </button>

              <button
                onClick={() => {
                  window.open(`/invoice-print/${createdInvoice.id}`, '_blank');
                }}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '12px' }}
              >
                🖨️ Print / Save PDF
              </button>

              <button
                onClick={() => {
                  setSuccessModalOpen(false);
                  setCreatedInvoice(null);
                }}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '12px', opacity: 0.6 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
