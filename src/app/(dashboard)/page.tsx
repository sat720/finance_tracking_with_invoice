'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  date: string;
  description: string;
  contact?: { name: string; type: string } | null;
}

interface InvoiceItem {
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  isRecurring: boolean;
  notes: string | null;
  client: { name: string; type: string };
  items: InvoiceItem[];
}

interface Budget {
  id: string;
  category: string;
  amount: number;
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date Filters
  const [filterType, setFilterType] = useState<string>('all-time');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  // Active Filter Ranges
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [txRes, invRes, budRes] = await Promise.all([
          fetch('/api/transactions'),
          fetch('/api/invoices'),
          fetch('/api/budgets'),
        ]);
        
        const txData = await txRes.json();
        const invData = await invRes.json();
        const budData = await budRes.json();
        
        setTransactions(txData.transactions || []);
        setInvoices(invData.invoices || []);
        setBudgets(budData.budgets || []);
      } catch (e) {
        console.error('Failed to load dashboard data:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Update date ranges based on selection
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (filterType === 'this-month') {
      setStartDate(startOfMonth);
      setEndDate(endOfMonth);
    } else if (filterType === 'last-month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      setStartDate(start);
      setEndDate(end);
    } else if (filterType === 'this-quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
      setStartDate(start);
      setEndDate(end);
    } else if (filterType === 'custom') {
      setStartDate(customStart ? new Date(customStart) : null);
      setEndDate(customEnd ? new Date(customEnd) : null);
    } else {
      setStartDate(null);
      setEndDate(null);
    }
  }, [filterType, customStart, customEnd]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="logo-icon" style={{ animation: 'spin 1.5s linear infinite', width: 40, height: 40 }}>VC</div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Filter helper
  const isInRange = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    const d = new Date(dateStr);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const filteredTx = transactions.filter(tx => isInRange(tx.date));

  // 1. KPI Calculations
  let totalRevenue = 0;
  let totalExpenses = 0;

  filteredTx.forEach((tx) => {
    if (tx.type === 'INCOME') {
      totalRevenue += tx.amount;
    } else {
      totalExpenses += tx.amount;
    }
  });

  const grossProfit = filteredTx
    .filter(tx => tx.type === 'INCOME' && (tx.category === 'PRODUCT_SALES' || tx.category === 'SERVICES'))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const operatingExpenses = filteredTx
    .filter(tx => tx.type === 'EXPENSE' && ['SALARIES', 'RENT', 'MARKETING', 'UTILITIES', 'VENDOR_PAYMENTS'].includes(tx.category))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const otherIncome = filteredTx
    .filter(tx => tx.type === 'INCOME' && tx.category === 'OTHER_INCOME')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const ebitda = grossProfit - operatingExpenses;
  const ebit = ebitda + otherIncome;
  const estimatedTax = ebit > 0 ? ebit * 0.25 : 0;
  const netProfitAfterTax = ebit - estimatedTax;

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Receivables (Unpaid Client Invoices: SENT/OVERDUE)
  const receivables = invoices
    .filter(inv => inv.client.type === 'CLIENT' && (inv.status === 'SENT' || inv.status === 'OVERDUE'))
    .reduce((sum, inv) => sum + inv.items.reduce((iSum, item) => iSum + item.totalAmount, 0), 0);

  // Payables (Unpaid Vendor Invoices: SENT/OVERDUE)
  const payables = invoices
    .filter(inv => inv.client.type === 'VENDOR' && (inv.status === 'SENT' || inv.status === 'OVERDUE'))
    .reduce((sum, inv) => sum + inv.items.reduce((iSum, item) => iSum + item.totalAmount, 0), 0);

  // Cash Position (All-time actual cash flow)
  const cashPosition = transactions.reduce((sum, tx) => {
    return tx.type === 'INCOME' ? sum + tx.amount : sum - tx.amount;
  }, 0);


  // 2. Chart Prep (Monthly Income vs Expense)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyDataMap: Record<string, { income: number; expense: number }> = {};
  
  // Fill default values for current and past month
  const currentMonthIdx = new Date().getMonth();
  const pastMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  
  monthlyDataMap[months[pastMonthIdx]] = { income: 0, expense: 0 };
  monthlyDataMap[months[currentMonthIdx]] = { income: 0, expense: 0 };

  transactions.forEach((tx) => {
    const d = new Date(tx.date);
    const m = months[d.getMonth()];
    if (!monthlyDataMap[m]) {
      monthlyDataMap[m] = { income: 0, expense: 0 };
    }
    if (tx.type === 'INCOME') {
      monthlyDataMap[m].income += tx.amount;
    } else {
      monthlyDataMap[m].expense += tx.amount;
    }
  });

  const chartMonths = Object.keys(monthlyDataMap).sort((a, b) => months.indexOf(a) - months.indexOf(b));
  const maxChartVal = Math.max(
    ...chartMonths.map(m => Math.max(monthlyDataMap[m].income, monthlyDataMap[m].expense)),
    100000
  );

  // GST & Tax Estimator Calculations
  const gstCollected = invoices
    .filter(inv => inv.client.type === 'CLIENT' && (inv.status === 'PAID' || inv.status === 'SENT'))
    .reduce((sum, inv) => sum + inv.items.reduce((iSum, item) => iSum + item.cgst + item.sgst + item.igst, 0), 0);

  const gstPaid = invoices
    .filter(inv => inv.client.type === 'VENDOR')
    .reduce((sum, inv) => sum + inv.items.reduce((iSum, item) => iSum + item.cgst + item.sgst + item.igst, 0), 0);

  const netGstPayable = gstCollected - gstPaid;
  
  // Tax Projection (YTD net profit projected for 12 months)
  const currentMonthsCount = Math.max(1, chartMonths.length);
  const projectedAnnualProfit = Math.max(0, netProfit) * (12 / currentMonthsCount);
  const estIncomeTax = projectedAnnualProfit * 0.25; // 25% Corporate tax rate
  const advanceTaxDue = estIncomeTax * 0.15; // 15% due for Q1

  // MoM Comparison Calculations
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth();
  
  const prevYear = currMonth === 0 ? currYear - 1 : currYear;
  const prevMonth = currMonth === 0 ? 11 : currMonth - 1;

  let currMonthIncome = 0;
  let currMonthExpense = 0;
  let prevMonthIncome = 0;
  let prevMonthExpense = 0;

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    const y = txDate.getFullYear();
    const m = txDate.getMonth();
    
    if (y === currYear && m === currMonth) {
      if (tx.type === 'INCOME') currMonthIncome += tx.amount;
      else currMonthExpense += tx.amount;
    } else if (y === prevYear && m === prevMonth) {
      if (tx.type === 'INCOME') prevMonthIncome += tx.amount;
      else prevMonthExpense += tx.amount;
    }
  });

  const getGrowthPercent = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const incomeMoM = getGrowthPercent(currMonthIncome, prevMonthIncome);
  const expenseMoM = getGrowthPercent(currMonthExpense, prevMonthExpense);

  const renderMoMTag = (growth: number) => {
    const isPositive = growth >= 0;
    const color = isPositive ? 'var(--success)' : 'var(--danger)';
    const text = `${isPositive ? '+' : ''}${growth.toFixed(1)}% MoM`;
    return (
      <span style={{ color, fontSize: '11px', fontWeight: 600, background: isPositive ? 'var(--success-bg)' : 'var(--danger-bg)', padding: '2px 6px', borderRadius: '4px' }}>
        {text}
      </span>
    );
  };

  // MoM Expense Category Comparison Chart Data
  const categoriesList = ['SALARIES', 'RENT', 'MARKETING', 'UTILITIES', 'VENDOR_PAYMENTS'];
  const momChartData = categoriesList.map((cat) => {
    let currVal = 0;
    let prevVal = 0;
    
    transactions.forEach((tx) => {
      if (tx.type !== 'EXPENSE' || tx.category !== cat) return;
      const txDate = new Date(tx.date);
      const y = txDate.getFullYear();
      const m = txDate.getMonth();
      
      if (y === currYear && m === currMonth) {
        currVal += tx.amount;
      } else if (y === prevYear && m === prevMonth) {
        prevVal += tx.amount;
      }
    });

    return {
      category: cat,
      current: currVal,
      previous: prevVal,
    };
  });

  const maxMomChartVal = Math.max(
    ...momChartData.map(d => Math.max(d.current, d.previous)),
    10000
  );

  // 3. Expense Category Breakdown (For Donut Chart)
  const expenseCats: Record<string, number> = {};
  filteredTx.forEach((tx) => {
    if (tx.type === 'EXPENSE') {
      expenseCats[tx.category] = (expenseCats[tx.category] || 0) + tx.amount;
    }
  });
  const totalExpenseSum = Object.values(expenseCats).reduce((a, b) => a + b, 0);

  // Donut Arc calculation helper
  let cumulativePercent = 0;
  const donutSlices = Object.entries(expenseCats).map(([category, amount]) => {
    const percent = totalExpenseSum > 0 ? amount / totalExpenseSum : 0;
    const slice = {
      category,
      amount,
      percent,
      startPercent: cumulativePercent,
    };
    cumulativePercent += percent;
    return slice;
  });

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent - Math.PI / 2);
    const y = Math.sin(2 * Math.PI * percent - Math.PI / 2);
    return [x, y];
  };

  const getCategoryColor = (cat: string, index: number) => {
    const colors = ['#8b5cf6', '#06b6d4', '#f43f5e', '#fbbf24', '#10b981', '#3b82f6'];
    return colors[index % colors.length];
  };

  return (
    <div>
      {/* Header Panel */}
      <div className="header-container">
        <div className="page-title-container">
          <h1 className="page-title">Financial Copilot</h1>
          <p className="page-subtitle">Real-time metrics, GST compliance ledger & cash flow analytics</p>
        </div>
        
        {/* Filters Panel */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: 'auto', padding: '10px 16px' }}
          >
            <option value="all-time">All Time</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="this-quarter">This Quarter</option>
            <option value="custom">Custom Range</option>
          </select>

          {filterType === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)} 
                style={{ width: 'auto', padding: '8px 12px' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)} 
                style={{ width: 'auto', padding: '8px 12px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Metrics Matrix */}
      <div className="grid-metrics">
        <div className="card metric-card">
          <div className="metric-header">
            <span>Total Revenue</span>
            {renderMoMTag(incomeMoM)}
          </div>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            Rs. {totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="metric-footer">Actual revenue inside period</div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span>Total Expenses</span>
            {renderMoMTag(expenseMoM)}
          </div>
          <div className="metric-value" style={{ color: 'var(--danger)' }}>
            Rs. {totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="metric-footer">Actual outflow inside period</div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span>Net Profit / Loss</span>
            <div className="metric-icon" style={{ 
              background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', 
              color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' 
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
          </div>
          <div className="metric-value" style={{ color: netProfit >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
            Rs. {netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="metric-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Net margin</span>
            <span style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
              {profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span>Outstanding Receivables</span>
            <div className="metric-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="16" y1="2" x2="16" y2="4" /><line x1="8" y1="2" x2="8" y2="4" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--info)' }}>
            Rs. {receivables.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="metric-footer">Due from clients (accrual)</div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span>Outstanding Payables</span>
            <div className="metric-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--warning)' }}>
            Rs. {payables.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="metric-footer">Owed to vendors (accrual)</div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span>Actual Cash Position</span>
            <div className="metric-icon" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
            </div>
          </div>
          <div className="metric-value" style={{ color: 'white' }}>
            Rs. {cashPosition.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="metric-footer">Cumulative actual cash in hand</div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', marginBottom: '30px' }}>
        
        {/* Income vs Expenses Bar Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Revenue vs Expenditure Trend</h2>
          <div className="chart-container">
            <svg viewBox="0 0 500 240" className="chart-svg">
              {/* Grid Lines */}
              <line x1="40" y1="40" x2="480" y2="40" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3,3" />
              <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3,3" />
              <line x1="40" y1="160" x2="480" y2="160" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3,3" />
              <line x1="40" y1="200" x2="480" y2="200" stroke="rgba(255, 255, 255, 0.08)" />

              {/* Draw Bars */}
              {chartMonths.map((m, idx) => {
                const item = monthlyDataMap[m];
                const barWidth = 36;
                const groupGap = 70;
                const startX = 80 + idx * (barWidth * 2 + groupGap);
                
                // Scale height
                const incHeight = (item.income / maxChartVal) * 150;
                const expHeight = (item.expense / maxChartVal) * 150;

                return (
                  <g key={m}>
                    {/* Income Bar (Emerald) */}
                    <rect
                      x={startX}
                      y={200 - incHeight}
                      width={barWidth}
                      height={incHeight}
                      fill="url(#emeraldGrad)"
                      rx="4"
                      style={{ transition: 'all 0.5s ease' }}
                    />
                    {/* Expense Bar (Rose) */}
                    <rect
                      x={startX + barWidth + 6}
                      y={200 - expHeight}
                      width={barWidth}
                      height={expHeight}
                      fill="url(#roseGrad)"
                      rx="4"
                      style={{ transition: 'all 0.5s ease' }}
                    />
                    
                    {/* Month Label */}
                    <text
                      x={startX + barWidth + 3}
                      y="222"
                      fill="var(--text-secondary)"
                      fontSize="12"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {m}
                    </text>
                  </g>
                );
              })}

              {/* Define Gradients */}
              <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          {/* Chart Legend */}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'var(--success)' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Revenue (Cash Inflows)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 12, height: 12, borderRadius: '3px', background: 'var(--danger)' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Expense (Cash Outflows)</span>
            </div>
          </div>
        </div>

        {/* Expenses Category Donut Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Expense Breakdown by Category</h2>
          <div className="chart-container" style={{ gap: '30px' }}>
            {totalExpenseSum === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No expense records in selected period</div>
            ) : (
              <>
                {/* SVG Donut */}
                <div style={{ width: '180px', height: '180px' }}>
                  <svg viewBox="-1.2 -1.2 2.4 2.4" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                    {donutSlices.map((slice, index) => {
                      // Calculate path arc values
                      const startCoords = getCoordinatesForPercent(slice.startPercent);
                      const endCoords = getCoordinatesForPercent(slice.startPercent + slice.percent);
                      
                      const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
                      
                      // Draw path string
                      const pathData = [
                        `M ${startCoords[0]} ${startCoords[1]}`, // Move to start coordinate
                        `A 1 1 0 ${largeArcFlag} 1 ${endCoords[0]} ${endCoords[1]}`, // Arc to end coordinate
                        `L 0 0`, // Line back to center
                        `Z` // Close path
                      ].join(' ');

                      return (
                        <path
                          key={slice.category}
                          d={pathData}
                          fill={getCategoryColor(slice.category, index)}
                          stroke="#120e1c"
                          strokeWidth="0.02"
                          style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                        />
                      );
                    })}
                    {/* Inner hole to make it a Donut */}
                    <circle cx="0" cy="0" r="0.65" fill="#120e1c" />
                  </svg>
                </div>
                
                {/* Legend list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, maxHeight: '220px', overflowY: 'auto' }}>
                  {donutSlices.map((slice, index) => (
                    <div key={slice.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: getCategoryColor(slice.category, index) }}></div>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {slice.category.toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {(slice.percent * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* MoM Category Expense Comparison Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>MoM Expense Comparison</h2>
          <div className="chart-container">
            <svg viewBox="0 0 500 240" className="chart-svg">
              {/* Grid Lines */}
              <line x1="40" y1="40" x2="480" y2="40" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3,3" />
              <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3,3" />
              <line x1="40" y1="160" x2="480" y2="160" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3,3" />
              <line x1="40" y1="200" x2="480" y2="200" stroke="rgba(255, 255, 255, 0.08)" />

              {/* Draw Bars */}
              {momChartData.map((item, idx) => {
                const groupWidth = 80;
                const startX = 65 + idx * groupWidth;
                
                // Scale heights
                const prevHeight = (item.previous / maxMomChartVal) * 150;
                const currHeight = (item.current / maxMomChartVal) * 150;

                // Category short name mapping
                const shortNames: Record<string, string> = {
                  SALARIES: 'Salaries',
                  RENT: 'Rent',
                  MARKETING: 'Mktg',
                  UTILITIES: 'Util',
                  VENDOR_PAYMENTS: 'Vendor',
                };

                return (
                  <g key={item.category}>
                    {/* Previous Month Bar (Cyan/Gray) */}
                    <rect
                      x={startX}
                      y={200 - prevHeight}
                      width={18}
                      height={prevHeight}
                      fill="url(#prevMonthGrad)"
                      rx="3"
                      style={{ transition: 'all 0.5s ease' }}
                    />
                    {/* Current Month Bar (Rose/Purple) */}
                    <rect
                      x={startX + 22}
                      y={200 - currHeight}
                      width={18}
                      height={currHeight}
                      fill="url(#currMonthGrad)"
                      rx="3"
                      style={{ transition: 'all 0.5s ease' }}
                    />
                    
                    {/* Category Label */}
                    <text
                      x={startX + 20}
                      y="222"
                      fill="var(--text-secondary)"
                      fontSize="11"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {shortNames[item.category] || item.category}
                    </text>
                  </g>
                );
              })}

              {/* Define Gradients */}
              <defs>
                <linearGradient id="prevMonthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#475569" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="currMonthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#be123c" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          {/* Chart Legend */}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '13px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#94a3b8' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Prev Month</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 12, height: 12, borderRadius: '3px', background: '#f43f5e' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Current Month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budgets & Tax Tracking Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', marginBottom: '30px' }}>
        
        {/* Budget vs Actual Tracker */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Budget Performance</h2>
            <Link href="/budgets" className="btn btn-secondary btn-sm">Configure Budgets</Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {budgets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>
                No budgets set. Click button above to configure budgets.
              </div>
            ) : (
              budgets.map((b) => {
                const nowForBud = new Date();
                const currYr = nowForBud.getFullYear();
                const currMth = nowForBud.getMonth();
                const actual = transactions
                  .filter(tx => tx.type === 'EXPENSE' && tx.category === b.category)
                  .filter(tx => {
                    const d = new Date(tx.date);
                    return d.getFullYear() === currYr && d.getMonth() === currMth;
                  })
                  .reduce((sum, tx) => sum + tx.amount, 0);

                const percentUsed = b.amount > 0 ? (actual / b.amount) * 100 : 0;
                const isOverBudget = actual > b.amount;

                return (
                  <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {b.category.toLowerCase().replace('_', ' ')}
                      </span>
                      <span style={{ color: isOverBudget ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        Rs. {actual.toLocaleString('en-IN', { maximumFractionDigits: 0 })} / Rs. {b.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({percentUsed.toFixed(0)}%)
                      </span>
                    </div>
                    {/* Progress Bar container */}
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(percentUsed, 100)}%`,
                        height: '100%',
                        background: isOverBudget ? 'var(--danger)' : 'var(--primary-gradient)',
                        borderRadius: '4px',
                        transition: 'width 0.4s ease'
                      }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* P&L & Tax Projections Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Profit & Loss Statement</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gross Revenue:</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>Rs. {grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Operating Expenses (OPEX):</span>
              <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Rs. {operatingExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-primary)' }}>EBITDA:</span>
              <span style={{ color: ebitda >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                Rs. {ebitda.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Other Income:</span>
              <span style={{ fontWeight: 600 }}>Rs. {otherIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-primary)' }}>EBIT (Profit Before Tax):</span>
              <span style={{ color: ebit >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                Rs. {ebit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Corporate Tax (25%):</span>
              <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Rs. {estimatedTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px', fontWeight: 700, fontSize: '14px' }}>
              <span style={{ color: 'var(--text-primary)' }}>Net Profit (After Tax):</span>
              <span style={{ color: netProfitAfterTax >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                Rs. {netProfitAfterTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            
            <div style={{ marginTop: '10px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Net GST Payable (GST Collected - ITC):</span>
                <span style={{ fontWeight: 600, color: netGstPayable >= 0 ? 'var(--warning)' : 'var(--success)', fontSize: '12px' }}>
                  Rs. {Math.max(0, netGstPayable).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Ledger Transactions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Recent Activity</h2>
            <Link href="/transactions" className="btn btn-secondary btn-sm">Full Ledger</Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredTx.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>
                No transaction activities logged.
              </div>
            ) : (
              filteredTx.slice(0, 5).map((tx) => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-glass)', fontSize: '13px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{tx.description}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(tx.date).toLocaleDateString('en-IN')} &bull; <span style={{ textTransform: 'capitalize' }}>{tx.category.toLowerCase().replace('_', ' ')}</span>
                    </span>
                  </div>
                  <span style={{ 
                    fontWeight: 600, 
                    color: tx.type === 'INCOME' ? 'var(--success)' : 'var(--danger)',
                    alignSelf: 'center'
                  }}>
                    {tx.type === 'INCOME' ? '+' : '-'} Rs. {tx.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
