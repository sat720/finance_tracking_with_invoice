import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail, sendWhatsApp } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'FOUNDER') {
      return NextResponse.json({ error: 'Unauthorized: Only Founders can run automated reminder sequences' }, { status: 403 });
    }

    const now = new Date();

    // Query all unpaid client invoices (SENT or OVERDUE)
    // We also check for SENT invoices where due date is in the past, auto-escalating them to OVERDUE.
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
        client: { type: 'CLIENT' },
        dueDate: { lt: now },
      },
      include: {
        client: true,
        items: true,
      },
    });

    const processed = [];
    const origin = new URL(request.url).origin;

    for (const inv of invoices) {
      const currentLevel = inv.reminderLevel || 0;
      const nextLevel = Math.min(currentLevel + 1, 3);
      
      const totalAmount = inv.items.reduce((sum, item) => sum + item.totalAmount, 0);
      const currencySymbol = inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : inv.currency === 'GBP' ? '£' : 'Rs.';
      const portalUrl = `${origin}/portal/${inv.client.id}`;
      
      let emailSubject = '';
      let emailText = '';
      let emailHtml = '';
      let waText = '';

      if (nextLevel === 1) {
        // Level 1: Friendly Reminder
        emailSubject = `Friendly Reminder: Outstanding Invoice ${inv.invoiceNumber} - Vriddhi Capital`;
        emailText = `Dear ${inv.client.name},\n\nThis is a friendly reminder that payment for invoice ${inv.invoiceNumber} (amounting to ${currencySymbol} ${totalAmount.toLocaleString('en-IN')}) was due on ${new Date(inv.dueDate).toLocaleDateString('en-IN')}.\n\nYou can view details and pay your invoice online here: ${portalUrl}\n\nIf you have already processed the payment, please ignore this email. Otherwise, please clear the dues at your earliest convenience.\n\nBest regards,\nVriddhi Capital`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">Payment Reminder (Friendly Notice)</h2>
            <p>Dear <strong>${inv.client.name}</strong>,</p>
            <p>This is a friendly note that invoice <strong>${inv.invoiceNumber}</strong> is currently outstanding.</p>
            <p style="font-size: 16px; font-weight: bold;">Amount Due: ${currencySymbol} ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            <p><strong>Due Date:</strong> ${new Date(inv.dueDate).toLocaleDateString('en-IN')}</p>
            <p style="margin: 24px 0;">
              <a href="${portalUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View & Pay Invoice Online</a>
            </p>
            <p style="font-size: 12px; color: #777;">Or copy link: <a href="${portalUrl}">${portalUrl}</a></p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 20px;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Automated notification from Vriddhi Capital.</p>
          </div>
        `;
        waText = `*PAYMENT REMINDER (Level 1)*\n\nDear ${inv.client.name},\nThis is a friendly reminder that invoice *${inv.invoiceNumber}* for *${currencySymbol} ${totalAmount.toLocaleString('en-IN')}* was due on ${new Date(inv.dueDate).toLocaleDateString('en-IN')}.\n\nView & Settle online: ${portalUrl}\n\nThank you!`;
      } else if (nextLevel === 2) {
        // Level 2: Urgent Notice
        emailSubject = `URGENT NOTICE: Overdue Payment for Invoice ${inv.invoiceNumber}`;
        emailText = `Dear ${inv.client.name},\n\nWe have not received payment for invoice ${inv.invoiceNumber} of ${currencySymbol} ${totalAmount.toLocaleString('en-IN')} which is now past due since ${new Date(inv.dueDate).toLocaleDateString('en-IN')}.\n\nPlease settle this invoice online immediately: ${portalUrl}\n\nBest regards,\nVriddhi Capital`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fef08a; border-radius: 8px; background-color: #fefce8;">
            <h2 style="color: #ca8a04; border-bottom: 2px solid #ca8a04; padding-bottom: 10px;">Payment Overdue (Urgent Notice)</h2>
            <p>Dear <strong>${inv.client.name}</strong>,</p>
            <p>We are writing to notify you that invoice <strong>${inv.invoiceNumber}</strong> is now seriously past due.</p>
            <p style="font-size: 18px; font-weight: bold; color: #a16207;">Outstanding Balance: ${currencySymbol} ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            <p><strong>Original Due Date:</strong> ${new Date(inv.dueDate).toLocaleDateString('en-IN')}</p>
            <p style="margin: 24px 0;">
              <a href="${portalUrl}" style="background-color: #ca8a04; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Overdue Dues Online</a>
            </p>
            <p style="font-size: 12px; color: #777;">Or copy link: <a href="${portalUrl}">${portalUrl}</a></p>
            <hr style="border: 0; border-top: 1px solid #fef08a; margin-top: 20px;" />
            <p style="font-size: 11px; color: #a16207; text-align: center;">Automated notification from Vriddhi Capital.</p>
          </div>
        `;
        waText = `*URGENT NOTICE (Level 2)*\n\nDear ${inv.client.name},\nInvoice *${inv.invoiceNumber}* (*${currencySymbol} ${totalAmount.toLocaleString('en-IN')}*) is past due since ${new Date(inv.dueDate).toLocaleDateString('en-IN')}.\n\nPay online immediately: ${portalUrl}`;
      } else {
        // Level 3: Final Demand Legal Notice
        emailSubject = `FINAL NOTICE: Demand for Payment of Invoice ${inv.invoiceNumber}`;
        emailText = `Dear ${inv.client.name},\n\nDespite multiple reminders, invoice ${inv.invoiceNumber} of ${currencySymbol} ${totalAmount.toLocaleString('en-IN')} remains unpaid. This is a FINAL NOTICE demanding full settlement within 48 hours.\n\nPlease settle the balance online immediately: ${portalUrl}\n\nBest regards,\nVikram Mehta\nFounder, Vriddhi Capital`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fecaca; border-radius: 8px; background-color: #fef2f2;">
            <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">FINAL DEMAND FOR PAYMENT</h2>
            <p>Dear <strong>${inv.client.name}</strong>,</p>
            <p>This is a formal and **FINAL DEMAND** for the payment of invoice <strong>${inv.invoiceNumber}</strong>.</p>
            <p style="font-size: 20px; font-weight: bold; color: #b91c1c;">Balance Owed: ${currencySymbol} ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            <p><strong>Due Date:</strong> ${new Date(inv.dueDate).toLocaleDateString('en-IN')}</p>
            <p style="margin: 24px 0;">
              <a href="${portalUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Settle Outstanding Dues Now</a>
            </p>
            <p style="font-size: 12px; color: #777;">Or copy link: <a href="${portalUrl}">${portalUrl}</a></p>
            <hr style="border: 0; border-top: 1px solid #fecaca; margin-top: 20px;" />
            <p style="font-size: 11px; color: #b91c1c; text-align: center; font-weight: bold;">FINAL REMINDER NOTICE - VRIDDHI CAPITAL LEGAL DEPT.</p>
          </div>
        `;
        waText = `*FINAL LEGAL NOTICE (Level 3)*\n\nDear ${inv.client.name},\nInvoice *${inv.invoiceNumber}* for *${currencySymbol} ${totalAmount.toLocaleString('en-IN')}* remains unpaid. Settle within 48 hours: ${portalUrl}`;
      }

      // Send Email
      await sendEmail({
        to: inv.client.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        type: 'OVERDUE_REMINDER',
      });

      // Send WhatsApp
      await sendWhatsApp({
        to: inv.client.phone,
        body: waText,
        type: 'OVERDUE_REMINDER',
      });

      // Update invoice reminder parameters in DB
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          status: 'OVERDUE',
          reminderLevel: nextLevel,
          lastReminderDate: now,
        },
      });

      processed.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        client: inv.client.name,
        previousLevel: currentLevel,
        newLevel: nextLevel,
      });
    }

    return NextResponse.json({ success: true, processedCount: processed.length, processed });
  } catch (error: any) {
    console.error('Reminder sequence run failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute reminders' }, { status: 500 });
  }
}
