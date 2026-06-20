'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'admin' | 'portal'>('admin');

  // Admin login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Client/Vendor portal lookup states
  const [portalSearch, setPortalSearch] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  const handleSubmit = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    const loginEmail = customEmail || email;
    const loginPassword = customPass || password;

    if (!loginEmail || !loginPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const handlePortalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortalLoading(true);
    setPortalError('');

    try {
      const res = await fetch('/api/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: portalSearch }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Portal access failed');
      }

      router.push(`/portal/${data.contactId}`);
    } catch (err: any) {
      setPortalError(err.message || 'Registration details not found.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleQuickLogin = (role: 'founder' | 'accountant' | 'viewer') => {
    const emailMap = {
      founder: 'founder@vriddhi.cap',
      accountant: 'accountant@vriddhi.cap',
      viewer: 'viewer@vriddhi.cap',
    };
    setEmail(emailMap[role]);
    setPassword('Password123!');
    handleSubmit(undefined, emailMap[role], 'Password123!');
  };

  return (
    <div className="login-wrapper">
      <div className="card login-card" style={{ padding: '36px' }}>
        <div className="login-logo">
          <div className="logo-icon" style={{ width: '40px', height: '40px', fontSize: '20px' }}>VC</div>
          <span className="logo-text" style={{ fontSize: '24px' }}>Vriddhi Cap</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', marginBottom: '6px' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Sign in to manage startup finances and GST invoicing</p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '24px' }}>
          <button
            onClick={() => { setActiveTab('admin'); setError(''); setPortalError(''); }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'admin' ? '2px solid var(--primary)' : 'none',
              color: activeTab === 'admin' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Admin / Team
          </button>
          <button
            onClick={() => { setActiveTab('portal'); setError(''); setPortalError(''); }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'portal' ? '2px solid var(--primary)' : 'none',
              color: activeTab === 'portal' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Client / Vendor
          </button>
        </div>

        {activeTab === 'admin' ? (
          <>
            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={(e) => handleSubmit(e)}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <hr style={{ flex: 1, border: '0', borderTop: '1px solid var(--border-glass)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demo quick login</span>
              <hr style={{ flex: 1, border: '0', borderTop: '1px solid var(--border-glass)' }} />
            </div>

            {/* Quick login buttons for evaluation convenience */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <button 
                onClick={() => handleQuickLogin('founder')} 
                className="btn btn-secondary btn-sm" 
                style={{ padding: '8px 4px', fontSize: '11px' }}
              >
                Founder
              </button>
              <button 
                onClick={() => handleQuickLogin('accountant')} 
                className="btn btn-secondary btn-sm" 
                style={{ padding: '8px 4px', fontSize: '11px' }}
              >
                Accountant
              </button>
              <button 
                onClick={() => handleQuickLogin('viewer')} 
                className="btn btn-secondary btn-sm" 
                style={{ padding: '8px 4px', fontSize: '11px' }}
              >
                Viewer
              </button>
            </div>
          </>
        ) : (
          <>
            {portalError && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {portalError}
              </div>
            )}

            <form onSubmit={handlePortalSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label htmlFor="portalSearch">Registered Email or GSTIN</label>
                <input
                  type="text"
                  id="portalSearch"
                  placeholder="name@business.com or 07ABCDE1234F1Z0"
                  value={portalSearch}
                  onChange={(e) => setPortalSearch(e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px', fontSize: '11px' }}>
                  Please enter the email address or GST number you used during onboarding.
                </small>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={portalLoading}
              >
                {portalLoading ? 'Verifying Profile...' : 'Access Portal'}
              </button>
            </form>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            New Client or Vendor?{' '}
            <Link href="/onboard" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Register & Onboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
