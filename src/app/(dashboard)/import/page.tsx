'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Contact {
  id: string;
  name: string;
  type: string;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  contactId: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [parsedItems, setParsedItems] = useState<ParsedTransaction[]>([]);
  const [importStatus, setImportStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function loadContacts() {
      try {
        const res = await fetch('/api/contacts');
        const data = await res.json();
        setContacts(data.contacts || []);
      } catch (e) {
        console.error('Failed to load contacts:', e);
      } finally {
        setLoading(false);
      }
    }
    loadContacts();
  }, []);

  const handleDownloadSample = () => {
    // Generate a simple CSV string
    const csvContent = 
      "Date,Description,Amount,Type\n" +
      "2026-06-18,Payment from client Acme Corp,85000.00,INFLOW\n" +
      "2026-06-19,AWS cloud servers bill,14200.00,OUTFLOW\n" +
      "2026-06-20,Office rent landlord,45000.00,OUTFLOW\n" +
      "2026-06-20,Google ads monthly budget,20000.00,OUTFLOW\n" +
      "2026-06-20,Consulting retainer fee TechSolutions,120000.00,INFLOW\n" +
      "2026-06-20,Employee salaries transfer payroll,220000.00,OUTFLOW\n" +
      "2026-06-20,Office power grid supply,6400.00,OUTFLOW\n";
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "vriddhi_bank_statement_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setUploading(false);
        return;
      }
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split('\n');
      const items: ParsedTransaction[] = [];

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle commas inside quotes or standard split
        const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (columns.length < 4) continue;

        const dateStr = columns[0].trim();
        const description = columns[1].trim().replace(/^"|"$/g, '');
        const amount = parseFloat(columns[2].trim());
        const rawType = columns[3].trim().toUpperCase();

        const type: 'INCOME' | 'EXPENSE' = (rawType === 'INFLOW' || rawType === 'CREDIT' || rawType === 'INCOME') ? 'INCOME' : 'EXPENSE';
        
        // Auto Categorize based on description keywords
        const descLower = description.toLowerCase();
        let category = type === 'INCOME' ? 'PRODUCT_SALES' : 'OTHER';

        if (type === 'INCOME') {
          if (descLower.includes('consult') || descLower.includes('services') || descLower.includes('retainer')) {
            category = 'SERVICES';
          } else if (descLower.includes('interest') || descLower.includes('dividend') || descLower.includes('fd')) {
            category = 'OTHER_INCOME';
          }
        } else {
          if (descLower.includes('salary') || descLower.includes('payroll') || descLower.includes('employee')) {
            category = 'SALARIES';
          } else if (descLower.includes('rent') || descLower.includes('office space') || descLower.includes('landlord')) {
            category = 'RENT';
          } else if (descLower.includes('adwords') || descLower.includes('ads') || descLower.includes('marketing') || descLower.includes('ad campaign')) {
            category = 'MARKETING';
          } else if (descLower.includes('aws') || descLower.includes('vercel') || descLower.includes('hosting') || descLower.includes('server') || descLower.includes('cloud')) {
            category = 'VENDOR_PAYMENTS';
          } else if (descLower.includes('electricity') || descLower.includes('power') || descLower.includes('internet') || descLower.includes('broadband')) {
            category = 'UTILITIES';
          }
        }

        // Try to match a contact from name keywords
        let contactId = '';
        const matchingContact = contacts.find(c => descLower.includes(c.name.toLowerCase().split(' ')[0]));
        if (matchingContact) {
          contactId = matchingContact.id;
        }

        items.push({
          date: dateStr,
          description,
          amount,
          type,
          category,
          contactId,
        });
      }

      setParsedItems(items);
      setImportStatus(`Successfully parsed ${items.length} statement rows. Please review categorization tags below.`);
    } catch (error) {
      console.error('CSV Parsing failed:', error);
      alert('Failed to parse CSV file. Ensure columns match: Date, Description, Amount, Type.');
    } finally {
      setUploading(false);
    }
  };

  const handleRowFieldChange = (idx: number, field: string, value: any) => {
    const updated = [...parsedItems];
    (updated[idx] as any)[field] = value;
    setParsedItems(updated);
  };

  const handleImportSubmit = async () => {
    if (parsedItems.length === 0) return;
    setLoading(true);
    setImportStatus('Importing transactions to ledger...');

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: parsedItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save import');
      }

      setParsedItems([]);
      setImportStatus(`Successfully imported ${data.count} transactions directly to the ledger database!`);
      router.refresh();
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const categories = {
    INCOME: ['PRODUCT_SALES', 'SERVICES', 'OTHER_INCOME'],
    EXPENSE: ['SALARIES', 'RENT', 'MARKETING', 'UTILITIES', 'VENDOR_PAYMENTS', 'OTHER'],
  };

  return (
    <div>
      <div className="header-container">
        <div className="page-title-container">
          <h1 className="page-title">Bank Statement CSV Import</h1>
          <p className="page-subtitle">Bulk import statement files and auto-tag transactions using keyword mapping</p>
        </div>
      </div>

      {/* CSV Upload Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '30px', marginBottom: '30px' }}>
        
        {/* Upload panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center', padding: '40px', borderStyle: 'dashed', borderWidth: '2px' }}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Upload bank statement CSV</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Columns format: Date, Description, Amount, Type (INFLOW/OUTFLOW)</p>
          </div>

          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            Choose CSV File
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }}
            />
          </label>
          {uploading && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Reading statement file...</span>}
        </div>

        {/* Instructions and Download template */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>CSV Import Instructions</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Our smart parser automatically flags cash flows and assigns category tags based on description keyword matching (e.g. matching &quot;AWS&quot; as Vendor Hosting expenses).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <div>&bull; <strong>Date:</strong> YYYY-MM-DD format</div>
            <div>&bull; <strong>Description:</strong> Narration of the voucher entry</div>
            <div>&bull; <strong>Amount:</strong> Decimal value of transfer value</div>
            <div>&bull; <strong>Type:</strong> Use INFLOW for receipts, OUTFLOW for payments</div>
          </div>

          <button onClick={handleDownloadSample} className="btn btn-secondary" style={{ marginTop: 'auto' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Download CSV Demo Template
          </button>
        </div>
      </div>

      {/* Progress status logs banner */}
      {importStatus && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{importStatus}</span>
          {parsedItems.length > 0 && (
            <button onClick={handleImportSubmit} className="btn btn-primary btn-sm">
              Commit Import Ledger
            </button>
          )}
        </div>
      )}

      {/* Preview and Edit Grid */}
      {parsedItems.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '16px' }}>
            Interactive Statement Review
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Auto-Category Tag *</th>
                  <th>Client/Vendor Association</th>
                  <th style={{ textAlign: 'right' }}>Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ width: '120px' }}>
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => handleRowFieldChange(idx, 'date', e.target.value)}
                        style={{ padding: '6px' }}
                      />
                    </td>
                    <td>
                      <span className={`badge ${item.type === 'INCOME' ? 'badge-paid' : 'badge-overdue'}`}>
                        {item.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW'}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleRowFieldChange(idx, 'description', e.target.value)}
                        style={{ padding: '6px' }}
                      />
                    </td>
                    <td>
                      <select
                        value={item.category}
                        onChange={(e) => handleRowFieldChange(idx, 'category', e.target.value)}
                        style={{ padding: '6px' }}
                      >
                        {item.type === 'INCOME'
                          ? categories.INCOME.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)
                          : categories.EXPENSE.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)
                        }
                      </select>
                    </td>
                    <td>
                      <select
                        value={item.contactId}
                        onChange={(e) => handleRowFieldChange(idx, 'contactId', e.target.value)}
                        style={{ padding: '6px' }}
                      >
                        <option value="">Link account...</option>
                        {contacts
                          .filter(c => item.type === 'INCOME' ? c.type === 'CLIENT' : c.type === 'VENDOR')
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))
                        }
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: item.type === 'INCOME' ? 'var(--success)' : 'var(--danger)' }}>
                      Rs. {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
