'use client';

import { useEffect, useState } from 'react';

interface Contact {
  id: string;
  type: 'CLIENT' | 'VENDOR';
  name: string;
  email: string;
  phone: string;
  billingAddress: string;
  gstin: string;
  state: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  
  // Auth state
  const [userRole, setUserRole] = useState<string>('VIEWER');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form states
  const [formType, setFormType] = useState<'CLIENT' | 'VENDOR'>('CLIENT');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formState, setFormState] = useState('');
  const [formError, setFormError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [meRes, contactsRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/contacts'),
        ]);
        
        const meData = await meRes.json();
        const contactsData = await contactsRes.json();

        setUserRole(meData.user?.role || 'VIEWER');
        setContacts(contactsData.contacts || []);
      } catch (e) {
        console.error('Failed to load contacts directory:', e);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const openCreateModal = () => {
    setEditingContact(null);
    setFormType('CLIENT');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormGstin('');
    setFormState('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormType(contact.type);
    setFormName(contact.name);
    setFormEmail(contact.email);
    setFormPhone(contact.phone);
    setFormAddress(contact.billingAddress);
    setFormGstin(contact.gstin);
    setFormState(contact.state);
    setFormError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setFormError('');

    // Validations
    if (!formName || !formEmail || !formAddress || !formGstin || !formState) {
      setFormError('All fields marked * are required');
      setSubmitLoading(false);
      return;
    }

    if (formGstin.trim().length !== 15) {
      setFormError('GSTIN must be exactly 15 characters (format: 07AAAAA1111A1Z1)');
      setSubmitLoading(false);
      return;
    }

    const payload = {
      type: formType,
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim(),
      billingAddress: formAddress.trim(),
      gstin: formGstin.toUpperCase().trim(),
      state: formState.trim(),
    };

    try {
      const url = editingContact ? `/api/contacts/${editingContact.id}` : '/api/contacts';
      const method = editingContact ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save contact');
      }

      // Refresh list
      const contactsRes = await fetch('/api/contacts');
      const contactsData = await contactsRes.json();
      setContacts(contactsData.contacts || []);

      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact? This will delete all associated transactions and invoices.')) {
      return;
    }

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete contact');
      }

      // Refresh
      setContacts(contacts.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (filterType === 'ALL') return true;
    return c.type === filterType;
  });

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  return (
    <div>
      <div className="header-container">
        <div className="page-title-container">
          <h1 className="page-title">Contacts Directory</h1>
          <p className="page-subtitle">Manage client profiles and vendor master records reusable across invoices</p>
        </div>

        <button 
          onClick={openCreateModal} 
          className="btn btn-primary no-print"
          disabled={userRole === 'VIEWER'}
          title={userRole === 'VIEWER' ? "Viewer: Read-Only" : undefined}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
          {userRole === 'VIEWER' ? 'Add Contact (Viewer: Read-Only)' : 'Add Contact'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }} className="no-print">
        <button 
          onClick={() => setFilterType('ALL')} 
          className={`btn ${filterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Master Records
        </button>
        <button 
          onClick={() => setFilterType('CLIENT')} 
          className={`btn ${filterType === 'CLIENT' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Clients Only
        </button>
        <button 
          onClick={() => setFilterType('VENDOR')} 
          className={`btn ${filterType === 'VENDOR' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Vendors Only
        </button>
      </div>

      {/* Directory Table Grid */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading directory...</div>
        ) : filteredContacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No contacts recorded. Click &quot;Add Contact&quot; to populate.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>GSTIN</th>
                  <th>State</th>
                  <th>Email & Phone</th>
                  <th>Billing Address</th>
                  <th className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <span className={`badge ${contact.type === 'CLIENT' ? 'badge-paid' : 'badge-pending'}`} style={{ fontSize: '10px' }}>
                        {contact.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{contact.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{contact.gstin}</td>
                    <td>{contact.state}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{contact.email}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{contact.phone || '-'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '240px' }}>{contact.billingAddress}</td>
                      <td className="no-print">
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a 
                            href={`/portal/${contact.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            Portal
                          </a>
                          {userRole !== 'VIEWER' && (
                            <button 
                              onClick={() => openEditModal(contact)} 
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '6px 8px' }}
                            >
                              Edit
                            </button>
                          )}
                          {userRole === 'FOUNDER' && (
                            <button 
                              onClick={() => handleDeleteContact(contact.id)} 
                              className="btn btn-danger btn-sm"
                              style={{ padding: '6px 8px' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                {editingContact ? 'Edit Master Record' : 'Create Contact Master'}
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

                <div className="form-group">
                  <label>Contact Type *</label>
                  <select 
                    value={formType} 
                    onChange={(e) => setFormType(e.target.value as 'CLIENT' | 'VENDOR')}
                    disabled={!!editingContact}
                  >
                    <option value="CLIENT">CLIENT (Buyer)</option>
                    <option value="VENDOR">VENDOR (Seller/Supplier)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="name">Business / Individual Name *</label>
                  <input
                    type="text"
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Enter name"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label htmlFor="email">Email address *</label>
                    <input
                      type="email"
                      id="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="finance@company.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input
                      type="text"
                      id="phone"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label htmlFor="gstin">GSTIN (15 characters) *</label>
                    <input
                      type="text"
                      id="gstin"
                      value={formGstin}
                      onChange={(e) => setFormGstin(e.target.value)}
                      placeholder="e.g. 07AAAAA1111A1Z1"
                      maxLength={15}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="state">Place of Supply (State) *</label>
                    <select
                      id="state"
                      value={formState}
                      onChange={(e) => setFormState(e.target.value)}
                      required
                    >
                      <option value="">Select State</option>
                      {indianStates.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="address">Billing Address *</label>
                  <textarea
                    id="address"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Enter detailed billing address"
                    rows={3}
                    required
                  ></textarea>
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
                  {submitLoading ? 'Saving...' : editingContact ? 'Update Record' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
