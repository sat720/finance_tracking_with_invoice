import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { prisma } from './db';

// Mail transporter helper
let mailTransporter: any = null;
function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    return mailTransporter;
  }
  return null;
}

// Twilio WhatsApp client helper
let twilioClient: any = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  
  if (sid && token) {
    twilioClient = twilio(sid, token);
    return twilioClient;
  }
  return null;
}

interface NotificationOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: 'INVOICE_DELIVERY' | 'OVERDUE_REMINDER';
}

export async function sendEmail({ to, subject, html, text, type }: NotificationOptions) {
  const transporter = getMailTransporter();
  let status = 'SIMULATED';
  let logMessage = text;

  try {
    if (transporter) {
      await transporter.sendMail({
        from: `"Vriddhi Capital" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });
      status = 'SUCCESS';
    } else {
      console.log(`[SMTP SIMULATION] To: ${to} | Subject: ${subject}`);
      status = 'SIMULATED';
    }
  } catch (error: any) {
    console.error('SMTP Delivery failed:', error);
    status = 'FAILED';
    logMessage = `Error: ${error.message || error}. Content: ${text}`;
  }

  // Record in Database Log
  await prisma.notificationLog.create({
    data: {
      type,
      recipient: to,
      channel: 'EMAIL',
      status,
      message: logMessage,
    },
  });
}

interface WhatsAppOptions {
  to: string;
  body: string;
  type: 'INVOICE_DELIVERY' | 'OVERDUE_REMINDER';
}

export async function sendWhatsApp({ to, body, type }: WhatsAppOptions) {
  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  // If TWILIO_TO_NUMBER is specified in .env, we route it there (useful for Twilio sandbox verified number testing)
  const toNumber = process.env.TWILIO_TO_NUMBER || to;
  
  let status = 'SIMULATED';
  let logMessage = body;

  try {
    if (client && fromNumber) {
      await client.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
        body,
      });
      status = 'SUCCESS';
    } else {
      console.log(`[WHATSAPP SIMULATION] To: ${toNumber} | Message: ${body}`);
      status = 'SIMULATED';
    }
  } catch (error: any) {
    console.error('WhatsApp Delivery failed:', error);
    status = 'FAILED';
    logMessage = `Error: ${error.message || error}. Content: ${body}`;
  }

  // Record in Database Log
  await prisma.notificationLog.create({
    data: {
      type,
      recipient: toNumber,
      channel: 'WHATSAPP',
      status,
      message: logMessage,
    },
  });
}
