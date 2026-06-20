import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail, sendWhatsApp } from '@/lib/notifications';
import crypto from 'crypto';

const SELLER_STATE = 'Delhi';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (clientId) {
      where.clientId = clientId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: true,
        items: true,
      },
      orderBy: { invoiceNumber: 'desc' },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const body = await request.json();
    const {
      clientId,
      invoiceNumber,
      status, // "DRAFT", "SENT", "PAID", "OVERDUE"
      issueDate,
      dueDate,
      notes,
      isRecurring,
      recurrenceInterval,
      currency,
      exchangeRate,
      items, // array of { description, hsnSacCode, quantity, rate, gstRate }
    } = body;

    if (!clientId || !invoiceNumber || !status || !issueDate || !dueDate || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if invoice number is unique
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber },
    });
    if (existing) {
      return NextResponse.json({ error: 'Invoice number must be unique' }, { status: 400 });
    }

    // Get buyer contact details
    const client = await prisma.contact.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Calculate GST splits
    const isSameState = client.state.trim().toLowerCase() === SELLER_STATE.toLowerCase();
    
    const processedItems = items.map((item: any) => {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gstRate = parseFloat(item.gstRate) || 0;
      const baseAmount = quantity * rate;
      
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isSameState) {
        cgst = baseAmount * (gstRate / 2) / 100;
        sgst = baseAmount * (gstRate / 2) / 100;
      } else {
        igst = baseAmount * gstRate / 100;
      }

      const totalAmount = baseAmount + cgst + sgst + igst;

      return {
        description: item.description,
        hsnSacCode: item.hsnSacCode || '9983',
        quantity,
        rate,
        gstRate,
        cgst,
        sgst,
        igst,
        totalAmount,
      };
    });

    // Generate simulated IRN (e-invoice ref)
    const irnHash = crypto.createHash('sha256').update(`${invoiceNumber}-${Date.now()}`).digest('hex');
    const eInvoiceRef = `IRN-${irnHash.slice(0, 40).toUpperCase()}`;

    // Calculate invoice total amount
    const totalAmountSum = processedItems.reduce((sum, item) => sum + item.totalAmount, 0);

    // Save in Database via transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId,
          status,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          billingAddress: client.billingAddress,
          isRecurring: !!isRecurring,
          recurrenceInterval: isRecurring ? (recurrenceInterval || 'MONTHLY') : null,
          eInvoiceRef: status !== 'DRAFT' ? eInvoiceRef : null,
          notes,
          currency: currency || 'INR',
          exchangeRate: parseFloat(exchangeRate) || 1.0,
        },
      });

      // Create items
      await Promise.all(
        processedItems.map((item) =>
          tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              ...item,
            },
          })
        )
      );

      // If status is PAID, automatically log a Transaction
      if (status === 'PAID') {
        const rateCoeff = parseFloat(exchangeRate) || 1.0;
        const isClient = client.type === 'CLIENT';
        await tx.transaction.create({
          data: {
            type: isClient ? 'INCOME' : 'EXPENSE',
            category: isClient ? 'PRODUCT_SALES' : 'VENDOR_PAYMENTS',
            amount: totalAmountSum * rateCoeff,
            date: new Date(issueDate),
            description: `Payment for Invoice ${invoiceNumber}`,
            contactId: clientId,
            invoiceId: inv.id,
          },
        });
      }

      return inv;
    });

    // Fetch complete invoice with items for notifications
    const completeInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true, client: true },
    });

    // Send notifications if status is SENT
    if (status === 'SENT' && completeInvoice) {
      const emailSubject = `New Invoice ${invoiceNumber} from Vriddhi Capital`;
      const emailText = `Dear ${client.name},\n\nWe have generated invoice ${invoiceNumber} for the amount of Rs. ${totalAmountSum.toFixed(2)}. The due date is ${new Date(dueDate).toLocaleDateString('en-IN')}.\n\nThank you for your business!\n\nBest regards,\nVriddhi Capital`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #6d28d9; border-bottom: 2px solid #6d28d9; padding-bottom: 10px;">Vriddhi Capital - GST Invoice</h2>
          <p>Dear <strong>${client.name}</strong>,</p>
          <p>We have generated invoice <strong>${invoiceNumber}</strong> for the amount of <strong>Rs. ${totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Description</th>
                <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              ${completeInvoice.items.map(item => `
                <tr>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">${item.description} (Qty: ${item.quantity} @ Rs.${item.rate})</td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">${item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold;">
                <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Total (incl. GST):</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right; color: #6d28d9;">Rs. ${totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-IN')}</p>
          <p>You can download the invoice PDF from the client portal.</p>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 30px;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      `;

      await sendEmail({
        to: client.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        type: 'INVOICE_DELIVERY',
      });

      const whatsappMessage = `Hello ${client.name},\n\nThis is an automated delivery of Invoice *${invoiceNumber}* from Vriddhi Capital.\n\n*Amount Due:* Rs. ${totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n*Due Date:* ${new Date(dueDate).toLocaleDateString('en-IN')}\n\nPlease process the payment. Thank you!`;
      
      await sendWhatsApp({
        to: client.phone,
        body: whatsappMessage,
        type: 'INVOICE_DELIVERY',
      });
    }

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('Failed to create invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
