import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail, sendWhatsApp } from '@/lib/notifications';
import crypto from 'crypto';

const SELLER_STATE = 'Delhi';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Failed to fetch invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = request.headers.get('x-user-role');
    if (role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized: Viewer role is read-only' }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const client = invoice.client;
    const currentTotal = invoice.items.reduce((sum, item) => sum + item.totalAmount, 0);

    const origin = new URL(request.url).origin;
    const portalUrl = `${origin}/portal/${client.id}`;

    if (action === 'send') {
      const emailSubject = `Invoice ${invoice.invoiceNumber} from Vriddhi Capital`;
      const emailText = `Dear ${client.name},\n\nThis is the delivery for invoice ${invoice.invoiceNumber} for the amount of Rs. ${currentTotal.toFixed(2)}. The due date is ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}.\n\nYou can view and pay your invoice online at: ${portalUrl}\n\nThank you!\n\nBest regards,\nVriddhi Capital`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #6d28d9; border-bottom: 2px solid #6d28d9; padding-bottom: 10px;">Vriddhi Capital - GST Invoice Delivery</h2>
          <p>Dear <strong>${client.name}</strong>,</p>
          <p>This is the delivery for invoice <strong>${invoice.invoiceNumber}</strong> for the amount of <strong>Rs. ${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>.</p>
          <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</p>
          <p style="margin: 24px 0;">
            <a href="${portalUrl}" style="background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View & Settle Invoice Online</a>
          </p>
          <p style="font-size: 12px; color: #777;">Or copy link: <a href="${portalUrl}">${portalUrl}</a></p>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 20px;" />
          <p>Thank you for your business!</p>
        </div>
      `;

      await sendEmail({
        to: client.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        type: 'INVOICE_DELIVERY',
      });

      await sendWhatsApp({
        to: client.phone,
        body: `Hello ${client.name},\n\nThis is the invoice delivery for *${invoice.invoiceNumber}* from Vriddhi Capital.\n\n*Amount:* Rs. ${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n*Due Date:* ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}\n\nView & pay online: ${portalUrl}\n\nThank you!`,
        type: 'INVOICE_DELIVERY',
      });

      if (invoice.status === 'DRAFT') {
        const irnHash = crypto.createHash('sha256').update(`${invoice.invoiceNumber}-${Date.now()}`).digest('hex');
        const eInvoiceRef = `IRN-${irnHash.slice(0, 40).toUpperCase()}`;

        await prisma.invoice.update({
          where: { id },
          data: { status: 'SENT', eInvoiceRef },
        });
      }

      return NextResponse.json({ success: true, message: 'Invoice sent successfully' });
    }

    if (action === 'reminder') {
      const emailSubject = `URGENT: Overdue Payment Reminder for Invoice ${invoice.invoiceNumber}`;
      const emailText = `Dear ${client.name},\n\nThis is an automated reminder that payment for invoice ${invoice.invoiceNumber} of Rs. ${currentTotal.toFixed(2)} was due on ${new Date(invoice.dueDate).toLocaleDateString('en-IN')} and is currently OVERDUE.\n\nPlease pay immediately online at: ${portalUrl}\n\nBest regards,\nVriddhi Capital`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px;">
          <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">Overdue Payment Notice</h2>
          <p>Dear <strong>${client.name}</strong>,</p>
          <p>This is a formal reminder that invoice <strong>${invoice.invoiceNumber}</strong> is currently <strong>OVERDUE</strong>.</p>
          <p style="font-size: 18px; font-weight: bold; color: #dc2626;">Outstanding Balance: Rs. ${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p><strong>Original Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</p>
          <p style="margin: 24px 0;">
            <a href="${portalUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Outstanding Dues Online</a>
          </p>
          <p style="font-size: 12px; color: #777;">Or copy link: <a href="${portalUrl}">${portalUrl}</a></p>
          <hr style="border: 0; border-top: 1px solid #fca5a5; margin-top: 30px;" />
          <p style="font-size: 11px; color: #7f1d1d; text-align: center;">Automated reminder message from Vriddhi Capital.</p>
        </div>
      `;

      await sendEmail({
        to: client.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        type: 'OVERDUE_REMINDER',
      });

      await sendWhatsApp({
        to: client.phone,
        body: `*URGENT PAYMENT REMINDER*\n\nHello ${client.name},\n\nInvoice *${invoice.invoiceNumber}* is currently OVERDUE.\n\n*Outstanding Balance:* Rs. ${currentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n*Due Date was:* ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}\n\nPay online: ${portalUrl}\n\nPlease settle the amount immediately. Thank you.`,
        type: 'OVERDUE_REMINDER',
      });

      if (invoice.status === 'SENT') {
        await prisma.invoice.update({
          where: { id },
          data: { status: 'OVERDUE' },
        });
      }

      return NextResponse.json({ success: true, message: 'Reminder sent successfully' });
    }

    const body = await request.json();
    const {
      clientId: newClientId,
      invoiceNumber: newInvoiceNumber,
      status: newStatus,
      issueDate,
      dueDate,
      notes,
      isRecurring,
      recurrenceInterval,
      items: newItems,
      currency,
      exchangeRate,
    } = body;

    if (!newClientId || !newInvoiceNumber || !newStatus || !issueDate || !dueDate || !newItems || !Array.isArray(newItems) || newItems.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newInvoiceNumber !== invoice.invoiceNumber) {
      const existing = await prisma.invoice.findUnique({
        where: { invoiceNumber: newInvoiceNumber },
      });
      if (existing) {
        return NextResponse.json({ error: 'Invoice number must be unique' }, { status: 400 });
      }
    }

    const buyer = await prisma.contact.findUnique({
      where: { id: newClientId },
    });
    if (!buyer) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const isSameState = buyer.state.trim().toLowerCase() === SELLER_STATE.toLowerCase();
    const processedItems = newItems.map((item: any) => {
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

    const totalAmountSum = processedItems.reduce((sum, item) => sum + item.totalAmount, 0);

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      const inv = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: newInvoiceNumber,
          clientId: newClientId,
          status: newStatus,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          billingAddress: buyer.billingAddress,
          isRecurring: !!isRecurring,
          recurrenceInterval: isRecurring ? (recurrenceInterval || 'MONTHLY') : null,
          notes,
          currency: currency || 'INR',
          exchangeRate: parseFloat(exchangeRate) || 1.0,
        },
      });

      await Promise.all(
        processedItems.map((item) =>
          tx.invoiceItem.create({
            data: {
              invoiceId: id,
              ...item,
            },
          })
        )
      );

      if (newStatus === 'PAID' && invoice.status !== 'PAID') {
        const rateCoeff = parseFloat(exchangeRate) || 1.0;
        const isClient = buyer.type === 'CLIENT';
        await tx.transaction.create({
          data: {
            type: isClient ? 'INCOME' : 'EXPENSE',
            category: isClient ? 'PRODUCT_SALES' : 'VENDOR_PAYMENTS',
            amount: totalAmountSum * rateCoeff,
            date: new Date(),
            description: `Payment for Invoice ${newInvoiceNumber}`,
            contactId: newClientId,
            invoiceId: id,
          },
        });
      }

      return inv;
    });

    return NextResponse.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error('Failed to update invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'FOUNDER') {
      return NextResponse.json({ error: 'Unauthorized: Only Founders can delete invoices' }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    await prisma.invoice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Failed to delete invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
