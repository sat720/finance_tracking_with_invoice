'use client';

import { useEffect, useState } from 'react';

interface Budget {
  id: string;
  category: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
}

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  date: string;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('VIEWER');

  // Form states
  const [selectedCategory, setSelectedCategory] = useState('SALARIES');
  const [formAmount, setFormAmount] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const categories = ['SALARIES', 'RENT', 'MARKETING', 'UTILITIES', 'VENDOR_PAYMENTS'];

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, budRes, txRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/budgets'),
          fetch('/api/transactions'),
        ]);

        const meData = await meRes.json();
        const budData = await budRes.json();
        const txData = await txRes.json();

        setUserRole(meData.user?.role || 'VIEWER');
        setBudgets(budData.budgets || []);
        setTransactions(txData.transactions || []);
      } catch (e) {
        console.error('Failed to load budget data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setFormError('');

    if (isNaN(parseFloat(formAmount)) || parseFloat(formAmount) < 0) {
      setFormError('Please enter a valid budget amount');
      setSubmitLoading(false);
      return;
    }

    const now = new Date();
    // Default budget periods: current year
    const periodStart = new Date(now.getFullYear(), 0, 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

    const payload = {
      category: selectedCategory,
      amount: parseFloat(formAmount),
      periodStart,
      periodEnd,
    };

    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save budget');
      }

      // Refresh budgets
      const budRes = await fetch('/api/budgets');
      const budData = await budRes.json();
      setBudgets(budData.budgets || []);

      setFormAmount('');
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving budget');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Calculate actual current month expenses per category
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const actualExpenses = transactions.filter((tx) => {
    if (tx.type !== 'EXPENSE') return false;
    const txDate = new Date(tx.date);
    return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
  });

  const getActualForCategory = (cat: string) => {
    return actualExpenses
      .filter(tx => tx.category === cat)
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  return (
    <div>
      <div className="header-container">
        <div className="page-title-container">
          <h1 className="page-title">Expense Budgets</h1>
          <p className="page-subtitle">Set monthly budget thresholds per category and track expenditure bounds</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
        
        {/* Set Budget Form Card */}
        {userRole !== 'VIEWER' ? (
          <div className="card" style={{ height: 'fit-content' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '20px' }}>
              Configure Category Budget
            </h2>
            
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

            <form onSubmit={handleSaveBudget}>
              <div className="form-group">
                <label>Select Category</label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="bAmount">Monthly Budget Limit (Rs.)</label>
                <input
                  type="number"
                  id="bAmount"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={submitLoading}
              >
                {submitLoading ? 'Saving...' : 'Set Budget Limit'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card" style={{ height: 'fit-content' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '10px' }}>
              Access Restrained
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Viewer accounts have read-only access. Only Founder and Accountant roles can modify budget allocations.
            </p>
          </div>
        )}

        {/* Budgets Progress Listings */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
            Current Month Performance ({now.toLocaleString('default', { month: 'long', year: 'numeric' })})
          </h2>

          {loading ? (
            <div>Loading budgets data...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {categories.map((cat) => {
                const b = budgets.find(x => x.category === cat);
                const limit = b ? b.amount : 0;
                const actual = getActualForCategory(cat);
                const percentUsed = limit > 0 ? (actual / limit) * 100 : 0;
                const isOver = actual > limit && limit > 0;

                return (
                  <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', textTransform: 'capitalize' }}>
                        {cat.toLowerCase().replace('_', ' ')}
                      </strong>
                      <span style={{ fontSize: '13px', color: isOver ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        Rs. {actual.toLocaleString('en-IN')} / {limit > 0 ? `Rs. ${limit.toLocaleString('en-IN')}` : 'No budget set'}
                      </span>
                    </div>

                    {limit > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(percentUsed, 100)}%`,
                            height: '100%',
                            background: isOver ? 'var(--danger)' : 'var(--primary-gradient)',
                            borderRadius: '5px',
                            transition: 'width 0.4s ease'
                          }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>{percentUsed.toFixed(0)}% consumed</span>
                          {isOver && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Budget Exceeded!</span>}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Set a budget on the left to track this category.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
