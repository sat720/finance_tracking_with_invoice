'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Contact {
  name: string;
  billingAddress: string;
  gstin: string;
  state: string;
}

interface InvoiceItem {
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
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  billingAddress: string;
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

export default function InvoicePrintPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        const data = await res.json();
        setInvoice(data.invoice);
      } catch (e) {
        console.error('Failed to fetch invoice for print:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (invoice) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice]);

  if (loading) {
    return <div style={{ padding: '30px', color: 'black', background: 'white', minHeight: '100vh' }}>Preparing invoice print format...</div>;
  }

  if (!invoice) {
    return <div style={{ padding: '30px', color: 'red', background: 'white', minHeight: '100vh' }}>Invoice not found.</div>;
  }

  const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const cgstTotal = invoice.items.reduce((sum, item) => sum + item.cgst, 0);
  const sgstTotal = invoice.items.reduce((sum, item) => sum + item.sgst, 0);
  const igstTotal = invoice.items.reduce((sum, item) => sum + item.igst, 0);
  const grandTotal = invoice.items.reduce((sum, item) => sum + item.totalAmount, 0);
  
  const isSameState = invoice.client.state.trim().toLowerCase() === SELLER_STATE.toLowerCase();

  return (
    <div className="invoice-print-container" style={{ padding: '40px', background: 'white', color: 'black', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* Invoice Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '15px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, letterSpacing: '0.05em' }}>TAX INVOICE</h1>
          <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>Original for Recipient</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Vriddhi Capital</h2>
          <p style={{ fontSize: '11px', color: '#555' }}>Delhi Financial Center, New Delhi</p>
          <p style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>GSTIN: {SELLER_GSTIN}</p>
        </div>
      </div>

      {/* Invoice details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', fontSize: '13px' }}>
        <div style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px 0', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>Details of Receiver (Billed To)</h3>
          <p style={{ fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0' }}>{invoice.client.name}</p>
          <p style={{ margin: '0 0 4px 0', color: '#333' }}>{invoice.billingAddress}</p>
          <p style={{ margin: '0 0 4px 0' }}>State: <strong>{invoice.client.state}</strong></p>
          <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 600 }}>GSTIN: {invoice.client.gstin}</p>
        </div>

        <div style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 6px 0', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>Invoice Metadata</h3>
          <div>Invoice No: <strong style={{ fontFamily: 'monospace' }}>{invoice.invoiceNumber}</strong></div>
          <div>Date of Issue: <strong>{new Date(invoice.issueDate).toLocaleDateString('en-IN')}</strong></div>
          <div>Due Date: <strong>{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</strong></div>
          <div>Place of Supply: <strong>{invoice.client.state}</strong></div>
        </div>
      </div>

      {/* IRN Reference banner */}
      {invoice.eInvoiceRef && (
        <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '4px', background: '#f8fafc', fontSize: '11px', marginBottom: '20px' }}>
          <strong>E-Invoice Reference Number (IRN):</strong>
          <span style={{ fontFamily: 'monospace', marginLeft: '6px', color: '#555', wordBreak: 'break-all' }}>{invoice.eInvoiceRef}</span>
        </div>
      )}

      {/* Line Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderTop: '1px solid black', borderBottom: '1px solid black' }}>
            <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Description of Services</th>
            <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>HSN</th>
            <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Qty</th>
            <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Rate ({getCurrencySymbol(invoice.currency).trim()})</th>
            <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>GST %</th>
            {isSameState ? (
              <>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>CGST</th>
                <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>SGST</th>
              </>
            ) : (
              <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>IGST</th>
            )}
            <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Total ({getCurrencySymbol(invoice.currency).trim()})</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{item.description}</td>
              <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center', fontFamily: 'monospace' }}>{item.hsnSacCode}</td>
              <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{item.rate.toFixed(2)}</td>
              <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{item.gstRate}%</td>
              {isSameState ? (
                <>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{item.cgst.toFixed(2)}</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{item.sgst.toFixed(2)}</td>
                </>
              ) : (
                <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{item.igst.toFixed(2)}</td>
              )}
              <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{item.totalAmount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Calculations summary splits panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '40px' }}>
        <div style={{ maxWidth: '60%' }}>
          {invoice.notes && (
            <div style={{ padding: '10px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <strong>Notes & Terms:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#444' }}>{invoice.notes}</p>
            </div>
          )}
        </div>
        
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal (Before Tax):</span>
            <span>{getCurrencySymbol(invoice.currency)}{subtotal.toFixed(2)}</span>
          </div>
          {isSameState ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CGST Total:</span>
                <span>{getCurrencySymbol(invoice.currency)}{cgstTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SGST Total:</span>
                <span>{getCurrencySymbol(invoice.currency)}{sgstTotal.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IGST Total:</span>
              <span>{getCurrencySymbol(invoice.currency)}{igstTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '2px solid black', paddingTop: '6px', fontSize: '15px', marginTop: '4px' }}>
            <span>Grand Total ({getCurrencySymbol(invoice.currency).trim()}):</span>
            <span>{getCurrencySymbol(invoice.currency)}{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Signature block */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '60px' }}>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <div style={{ height: '50px' }}></div>
          <div style={{ borderTop: '1px solid black', paddingTop: '6px', fontSize: '12px', fontWeight: 'bold' }}>
            Authorized Signatory
          </div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>For Vriddhi Capital</div>
        </div>
      </div>
    </div>
  );
}
