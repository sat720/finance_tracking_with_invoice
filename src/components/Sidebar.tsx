'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

interface SidebarProps {
  user: {
    name: string;
    role: string;
    email: string;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'dashboard', roles: ['FOUNDER', 'ACCOUNTANT', 'VIEWER'] },
    { name: 'Invoices', path: '/invoices', icon: 'invoices', roles: ['FOUNDER', 'ACCOUNTANT', 'VIEWER'] },
    { name: 'Transactions', path: '/transactions', icon: 'transactions', roles: ['FOUNDER', 'ACCOUNTANT', 'VIEWER'] },
    { name: 'Contacts Directory', path: '/contacts', icon: 'contacts', roles: ['FOUNDER', 'ACCOUNTANT', 'VIEWER'] },
    { name: 'Budgets', path: '/budgets', icon: 'budgets', roles: ['FOUNDER', 'ACCOUNTANT', 'VIEWER'] },
    { name: 'Import CSV', path: '/import', icon: 'import', roles: ['FOUNDER', 'ACCOUNTANT'] },
    { name: 'Admin Panel', path: '/admin', icon: 'admin', roles: ['FOUNDER'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(user.role));

  const getIcon = (name: string) => {
    switch (name) {
      case 'dashboard':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
        );
      case 'invoices':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case 'transactions':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case 'contacts':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'budgets':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        );
      case 'import':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        );
      case 'admin':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="mobile-header no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="logo-icon" style={{ width: '28px', height: '28px', fontSize: '14px' }}>VC</div>
          <span className="logo-text" style={{ fontSize: '18px' }}>Vriddhi</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Sidebar navigation */}
      <aside className={`sidebar no-print ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="logo-container">
          <div className="logo-icon">VC</div>
          <span className="logo-text">Vriddhi Cap</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ul className="nav-links">
            {filteredItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {getIcon(item.icon)}
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role}</span>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-header {
            display: flex !important;
          }
          .sidebar {
            transform: translateY(-100%);
            height: auto;
            position: fixed;
            top: 61px;
            left: 0;
            right: 0;
            bottom: auto;
            border-bottom: 1px solid var(--border-glass);
            border-right: none;
            background: #0b0814;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: none !important;
          }
          .sidebar.mobile-open {
            transform: translateY(0);
            display: flex !important;
            z-index: 999;
          }
          .nav-links {
            flex-direction: column !important;
            padding: 16px !important;
            overflow-x: visible !important;
          }
          .sidebar-footer {
            display: flex !important;
            padding: 16px !important;
            background-color: rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
    </>
  );
}
