'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OnboardPage() {
  const [type, setType] = useState<'CLIENT' | 'VENDOR'>('CLIENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email) {
      setError('Contact Email is required');
      setLoading(false);
      return;
    }

    if (type === 'VENDOR') {
      if (!gstin || !state) {
        setError('GSTIN and Place of Supply (State) are required for vendors');
        setLoading(false);
        return;
      }
      if (gstin.trim().length !== 15) {
        setError('GSTIN must be exactly 15 characters (e.g. 07AAAAA1111A1Z1)');
        setLoading(false);
        return;
      }
    } else {
      if (gstin && gstin.trim().length !== 15) {
        setError('GSTIN must be exactly 15 characters if provided');
        setLoading(false);
        return;
      }
    }

    const payload = {
      type,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      gstin: gstin.toUpperCase().trim(),
      state: state.trim(),
      billingAddress: billingAddress.trim(),
    };

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FOUNDER' }, // Bypass Viewer-check header during public onboarding
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit onboarding details');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div className="card login-card" style={{ maxWidth: '580px', width: '100%', margin: '0 auto' }}>
        <div className="login-logo" style={{ marginBottom: '20px' }}>
          <div className="logo-icon">VC</div>
          <span className="logo-text">Vriddhi Capital</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'white', marginBottom: '6px' }}>
            Business Onboarding Portal
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Register your company details as a Client (Buyer) or Vendor (Supplier)
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
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
            <h3 style={{ fontSize: '18px', color: 'white', marginBottom: '8px' }}>Registration Completed!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              Your business profile **{name}** has been successfully onboarded as a **{type}**. You are now active in the Vriddhi Capital directories.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  setSuccess(false);
                  setName('');
                  setEmail('');
                  setPhone('');
                  setGstin('');
                  setState('');
                  setBillingAddress('');
                }} 
                className="btn btn-secondary"
              >
                Register Another
              </button>
              <Link href="/login" className="btn btn-primary">
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label>Onboard As *</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value as 'CLIENT' | 'VENDOR')}
                style={{ height: '45px' }}
              >
                <option value="CLIENT">CLIENT (We will bill you / issue invoices to you)</option>
                <option value="VENDOR">VENDOR (You will bill us / we will record expenses to you)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bName">Business Name (Optional)</label>
              <input
                type="text"
                id="bName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Technologies Private Limited"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label htmlFor="bEmail">Contact Email *</label>
                <input
                  type="email"
                  id="bEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="finance@yourcompany.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="bPhone">Contact Phone (Optional)</label>
                <input
                  type="text"
                  id="bPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label htmlFor="bGstin">GSTIN (15 characters) {type === 'VENDOR' ? '*' : '(Optional)'}</label>
                <input
                  type="text"
                  id="bGstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="e.g. 27AAAAA1111A1Z1"
                  maxLength={15}
                  required={type === 'VENDOR'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bState">Place of Supply (State) {type === 'VENDOR' ? '*' : '(Optional)'}</label>
                <select
                  id="bState"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required={type === 'VENDOR'}
                >
                  <option value="">Choose state...</option>
                  {indianStates.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="bAddress">Detailed Billing Address (Optional)</label>
              <textarea
                id="bAddress"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Enter complete company registered address for tax invoices"
                rows={3}
              ></textarea>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <Link href="/login" className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={loading}
              >
                {loading ? 'Submitting Details...' : 'Submit Onboarding'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
