import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const SALT = process.env.AUTH_SALT || 'vriddhi_salt_2026_default';

function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 1000, 64, 'sha512').toString('hex');
}

async function main() {
  console.log('Seeding started...');

  // 1. Clean Database
  await prisma.notificationLog.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleaned.');

  // 2. Create Users
  const hashedPassword = hashPassword('Password123!');
  
  await prisma.user.create({
    data: {
      email: 'founder@vriddhi.cap',
      name: 'Vikram Mehta',
      password: hashedPassword,
      role: 'FOUNDER',
    },
  });

  await prisma.user.create({
    data: {
      email: 'accountant@vriddhi.cap',
      name: 'Sneha Sharma',
      password: hashedPassword,
      role: 'ACCOUNTANT',
    },
  });

  await prisma.user.create({
    data: {
      email: 'viewer@vriddhi.cap',
      name: 'Aditya Roy',
      password: hashedPassword,
      role: 'VIEWER',
    },
  });

  console.log('Users seeded.');

  // 3. Create Contacts (Clients and Vendors)
  const acme = await prisma.contact.create({
    data: {
      type: 'CLIENT',
      name: 'Acme Corporation Pvt Ltd',
      email: 'finance@acme.com',
      phone: '+919876543210',
      billingAddress: '402, Connaught Place, New Delhi, Delhi - 110001',
      gstin: '07AAAAA1111A1Z1',
      state: 'Delhi',
    },
  });

  const techsolutions = await prisma.contact.create({
    data: {
      type: 'CLIENT',
      name: 'TechSolutions India Ltd',
      email: 'billing@techsolutions.in',
      phone: '+918765432109',
      billingAddress: 'B-Wing, 12th Floor, Trade Tower, Lower Parel, Mumbai, Maharashtra - 400013',
      gstin: '27BBBBB2222B2Z2',
      state: 'Maharashtra',
    },
  });

  const vikas = await prisma.contact.create({
    data: {
      type: 'CLIENT',
      name: 'Vikas Enterprises',
      email: 'contact@vikasent.com',
      phone: '+917654321098',
      billingAddress: '88, MG Road, Ashok Nagar, Bengaluru, Karnataka - 560001',
      gstin: '29CCCCC3333C3Z3',
      state: 'Karnataka',
    },
  });

  const hostings = await prisma.contact.create({
    data: {
      type: 'VENDOR',
      name: 'Hostings Cloud Inc',
      email: 'support@hostingscloud.com',
      phone: '+916543210987',
      billingAddress: 'Cloud Complex, Vashi, Navi Mumbai, Maharashtra - 400703',
      gstin: '27DDDDD4444D4Z4',
      state: 'Maharashtra',
    },
  });

  const marketinghub = await prisma.contact.create({
    data: {
      type: 'VENDOR',
      name: 'Marketing Hub Agency',
      email: 'accounts@marketinghub.com',
      phone: '+915432109876',
      billingAddress: '15, Okhla Industrial Area Phase 3, New Delhi, Delhi - 110020',
      gstin: '07EEEEE5555E5Z5',
      state: 'Delhi',
    },
  });

  const officeco = await prisma.contact.create({
    data: {
      type: 'VENDOR',
      name: 'Office Supplies Co',
      email: 'supplies@officeco.in',
      phone: '+914321098765',
      billingAddress: '2, Nehru Place, New Delhi, Delhi - 110019',
      gstin: '07FFFFF6666F6Z6',
      state: 'Delhi',
    },
  });

  console.log('Contacts seeded.');

  // Helper function to create invoice and item
  async function seedInvoice(params: {
    invoiceNumber: string;
    clientId: string;
    status: string;
    issueDate: Date;
    dueDate: Date;
    billingAddress: string;
    isRecurring?: boolean;
    notes?: string;
    description: string;
    rate: number;
    quantity: number;
    gstRate: number;
    isSameState: boolean;
  }) {
    const baseAmount = params.rate * params.quantity;
    let cgst = 0, sgst = 0, igst = 0;
    if (params.isSameState) {
      cgst = baseAmount * (params.gstRate / 2) / 100;
      sgst = baseAmount * (params.gstRate / 2) / 100;
    } else {
      igst = baseAmount * params.gstRate / 100;
    }
    const totalAmount = baseAmount + cgst + sgst + igst;

    const irnHash = crypto.createHash('sha256').update(`${params.invoiceNumber}-${Date.now()}`).digest('hex');
    const eInvoiceRef = params.status !== 'DRAFT' ? `IRN-${irnHash.slice(0, 40).toUpperCase()}` : null;

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: params.invoiceNumber,
        clientId: params.clientId,
        status: params.status,
        issueDate: params.issueDate,
        dueDate: params.dueDate,
        billingAddress: params.billingAddress,
        isRecurring: params.isRecurring || false,
        recurrenceInterval: params.isRecurring ? 'MONTHLY' : null,
        eInvoiceRef,
        notes: params.notes || null,
      },
    });

    await prisma.invoiceItem.create({
      data: {
        invoiceId: inv.id,
        description: params.description,
        hsnSacCode: '9983',
        quantity: params.quantity,
        rate: params.rate,
        gstRate: params.gstRate,
        cgst,
        sgst,
        igst,
        totalAmount,
      },
    });

    return { id: inv.id, totalAmount };
  }

  // 4. Create 10 CLIENT Invoices (Issued Invoices)
  console.log('Seeding 10 client invoices...');
  const invC1 = await seedInvoice({
    invoiceNumber: 'INV-2026-0001',
    clientId: acme.id,
    status: 'PAID',
    issueDate: new Date('2026-05-10T10:00:00Z'),
    dueDate: new Date('2026-05-25T10:00:00Z'),
    billingAddress: acme.billingAddress,
    description: 'SaaS Platform Licensing Fee',
    rate: 150000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invC2 = await seedInvoice({
    invoiceNumber: 'INV-2026-0002',
    clientId: techsolutions.id,
    status: 'OVERDUE',
    issueDate: new Date('2026-05-20T10:00:00Z'),
    dueDate: new Date('2026-06-04T10:00:00Z'),
    billingAddress: techsolutions.billingAddress,
    description: 'Software Development Consulting',
    rate: 280000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invC3 = await seedInvoice({
    invoiceNumber: 'INV-2026-0003',
    clientId: vikas.id,
    status: 'SENT',
    issueDate: new Date('2026-06-05T10:00:00Z'),
    dueDate: new Date('2026-06-20T10:00:00Z'),
    billingAddress: vikas.billingAddress,
    description: 'API Integration development work',
    rate: 95000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invC4 = await seedInvoice({
    invoiceNumber: 'INV-2026-0004',
    clientId: acme.id,
    status: 'DRAFT',
    issueDate: new Date('2026-06-15T10:00:00Z'),
    dueDate: new Date('2026-06-30T10:00:00Z'),
    billingAddress: acme.billingAddress,
    description: 'Monthly Cloud retainer',
    rate: 20000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invC5 = await seedInvoice({
    invoiceNumber: 'INV-2026-0005',
    clientId: techsolutions.id,
    status: 'PAID',
    issueDate: new Date('2026-05-12T10:00:00Z'),
    dueDate: new Date('2026-05-27T10:00:00Z'),
    billingAddress: techsolutions.billingAddress,
    description: 'Security Audit Services',
    rate: 100000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invC6 = await seedInvoice({
    invoiceNumber: 'INV-2026-0006',
    clientId: vikas.id,
    status: 'PAID',
    issueDate: new Date('2026-05-18T10:00:00Z'),
    dueDate: new Date('2026-06-02T10:00:00Z'),
    billingAddress: vikas.billingAddress,
    description: 'UI/UX Redesign Deliverables',
    rate: 50000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invC7 = await seedInvoice({
    invoiceNumber: 'INV-2026-0007',
    clientId: acme.id,
    status: 'SENT',
    issueDate: new Date('2026-06-02T10:00:00Z'),
    dueDate: new Date('2026-06-17T10:00:00Z'),
    billingAddress: acme.billingAddress,
    description: 'DevOps Platform Setup Support',
    rate: 100000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invC8 = await seedInvoice({
    invoiceNumber: 'INV-2026-0008',
    clientId: techsolutions.id,
    status: 'SENT',
    issueDate: new Date('2026-06-10T10:00:00Z'),
    dueDate: new Date('2026-06-25T10:00:00Z'),
    billingAddress: techsolutions.billingAddress,
    description: 'Infrastructure Management Support',
    rate: 70000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invC9 = await seedInvoice({
    invoiceNumber: 'INV-2026-0009',
    clientId: vikas.id,
    status: 'OVERDUE',
    issueDate: new Date('2026-05-28T10:00:00Z'),
    dueDate: new Date('2026-06-12T10:00:00Z'),
    billingAddress: vikas.billingAddress,
    description: 'Data Analytics Integration Pipeline',
    rate: 60000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invC10 = await seedInvoice({
    invoiceNumber: 'INV-2026-0010',
    clientId: acme.id,
    status: 'DRAFT',
    issueDate: new Date('2026-06-18T10:00:00Z'),
    dueDate: new Date('2026-07-03T10:00:00Z'),
    billingAddress: acme.billingAddress,
    description: 'Technical Writing and API Documentation',
    rate: 10000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  // 5. Create 10 VENDOR Invoices (Received Bills)
  console.log('Seeding 10 vendor invoices...');
  const invV1 = await seedInvoice({
    invoiceNumber: 'VND-2026-0001',
    clientId: hostings.id,
    status: 'PAID',
    issueDate: new Date('2026-05-05T10:00:00Z'),
    dueDate: new Date('2026-05-20T10:00:00Z'),
    billingAddress: hostings.billingAddress,
    description: 'Cloud Server Infrastructure hosting',
    rate: 22000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invV2 = await seedInvoice({
    invoiceNumber: 'VND-2026-0002',
    clientId: marketinghub.id,
    status: 'PAID',
    issueDate: new Date('2026-05-15T10:00:00Z'),
    dueDate: new Date('2026-05-30T10:00:00Z'),
    billingAddress: marketinghub.billingAddress,
    description: 'Q2 Performance Marketing Campaign Management',
    rate: 35000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invV3 = await seedInvoice({
    invoiceNumber: 'VND-2026-0003',
    clientId: officeco.id,
    status: 'PAID',
    issueDate: new Date('2026-05-20T10:00:00Z'),
    dueDate: new Date('2026-06-04T10:00:00Z'),
    billingAddress: officeco.billingAddress,
    description: 'Office Stationary boxes and printing papers',
    rate: 8500,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invV4 = await seedInvoice({
    invoiceNumber: 'VND-2026-0004',
    clientId: hostings.id,
    status: 'SENT',
    issueDate: new Date('2026-06-01T10:00:00Z'),
    dueDate: new Date('2026-06-15T10:00:00Z'),
    billingAddress: hostings.billingAddress,
    description: 'Cloud servers hosting for June',
    rate: 22000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invV5 = await seedInvoice({
    invoiceNumber: 'VND-2026-0005',
    clientId: marketinghub.id,
    status: 'SENT',
    issueDate: new Date('2026-06-02T10:00:00Z'),
    dueDate: new Date('2026-06-17T10:00:00Z'),
    billingAddress: marketinghub.billingAddress,
    description: 'Social Media Management retainer',
    rate: 50000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invV6 = await seedInvoice({
    invoiceNumber: 'VND-2026-0006',
    clientId: officeco.id,
    status: 'OVERDUE',
    issueDate: new Date('2026-05-25T10:00:00Z'),
    dueDate: new Date('2026-06-09T10:00:00Z'),
    billingAddress: officeco.billingAddress,
    description: 'Conference room chairs replacement (5 units)',
    rate: 15000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invV7 = await seedInvoice({
    invoiceNumber: 'VND-2026-0007',
    clientId: hostings.id,
    status: 'OVERDUE',
    issueDate: new Date('2026-05-28T10:00:00Z'),
    dueDate: new Date('2026-06-12T10:00:00Z'),
    billingAddress: hostings.billingAddress,
    description: 'Database Backup premium storage storage billing',
    rate: 30000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  const invV8 = await seedInvoice({
    invoiceNumber: 'VND-2026-0008',
    clientId: marketinghub.id,
    status: 'DRAFT',
    issueDate: new Date('2026-06-12T10:00:00Z'),
    dueDate: new Date('2026-06-27T10:00:00Z'),
    billingAddress: marketinghub.billingAddress,
    description: 'Brand Guidelines Identity design work',
    rate: 20000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invV9 = await seedInvoice({
    invoiceNumber: 'VND-2026-0009',
    clientId: officeco.id,
    status: 'DRAFT',
    issueDate: new Date('2026-06-15T10:00:00Z'),
    dueDate: new Date('2026-06-30T10:00:00Z'),
    billingAddress: officeco.billingAddress,
    description: 'Coffee pantry kitchen supplies',
    rate: 5000,
    quantity: 1,
    gstRate: 18,
    isSameState: true,
  });

  const invV10 = await seedInvoice({
    invoiceNumber: 'VND-2026-0010',
    clientId: hostings.id,
    status: 'SENT',
    issueDate: new Date('2026-06-18T10:00:00Z'),
    dueDate: new Date('2026-07-03T10:00:00Z'),
    billingAddress: hostings.billingAddress,
    description: 'Developer workspace cloud instances',
    rate: 10000,
    quantity: 1,
    gstRate: 18,
    isSameState: false,
  });

  // 6. Create Transactions (Income & Expenditures)
  console.log('Seeding transactions...');
  await prisma.transaction.createMany({
    data: [
      // Transactions matching Client PAID invoices
      {
        type: 'INCOME',
        category: 'PRODUCT_SALES',
        amount: invC1.totalAmount,
        date: new Date('2026-05-15T10:00:00Z'),
        description: 'Payment for Invoice INV-2026-0001 (SaaS licensing)',
        contactId: acme.id,
        invoiceId: invC1.id,
      },
      {
        type: 'INCOME',
        category: 'PRODUCT_SALES',
        amount: invC5.totalAmount,
        date: new Date('2026-05-20T10:00:00Z'),
        description: 'Payment for Invoice INV-2026-0005 (Security Audit)',
        contactId: techsolutions.id,
        invoiceId: invC5.id,
      },
      {
        type: 'INCOME',
        category: 'PRODUCT_SALES',
        amount: invC6.totalAmount,
        date: new Date('2026-05-28T10:00:00Z'),
        description: 'Payment for Invoice INV-2026-0006 (UI/UX deliverables)',
        contactId: vikas.id,
        invoiceId: invC6.id,
      },
      // Non-invoice Income
      {
        type: 'INCOME',
        category: 'OTHER_INCOME',
        amount: 40000,
        date: new Date('2026-06-12T10:00:00Z'),
        description: 'Interest payout from bank FD',
        contactId: null,
        invoiceId: null,
      },
      // Transactions matching Vendor PAID invoices
      {
        type: 'EXPENSE',
        category: 'VENDOR_PAYMENTS',
        amount: invV1.totalAmount,
        date: new Date('2026-05-15T10:00:00Z'),
        description: 'Payment for Invoice VND-2026-0001 (Cloud Hosting)',
        contactId: hostings.id,
        invoiceId: invV1.id,
      },
      {
        type: 'EXPENSE',
        category: 'VENDOR_PAYMENTS',
        amount: invV2.totalAmount,
        date: new Date('2026-05-18T10:00:00Z'),
        description: 'Payment for Invoice VND-2026-0002 (Marketing campaign)',
        contactId: marketinghub.id,
        invoiceId: invV2.id,
      },
      {
        type: 'EXPENSE',
        category: 'VENDOR_PAYMENTS',
        amount: invV3.totalAmount,
        date: new Date('2026-05-28T10:00:00Z'),
        description: 'Payment for Invoice VND-2026-0003 (Office supplies)',
        contactId: officeco.id,
        invoiceId: invV3.id,
      },
      // General Core Expenses (Payroll, Rent, Utilities)
      {
        type: 'EXPENSE',
        category: 'SALARIES',
        amount: 250000,
        date: new Date('2026-05-01T10:00:00Z'),
        description: 'Monthly employee payroll distribution',
        contactId: null,
        invoiceId: null,
      },
      {
        type: 'EXPENSE',
        category: 'RENT',
        amount: 50000,
        date: new Date('2026-05-02T10:00:00Z'),
        description: 'Co-working office rent (Delhi HQ)',
        contactId: null,
        invoiceId: null,
      },
      {
        type: 'EXPENSE',
        category: 'UTILITIES',
        amount: 12000,
        date: new Date('2026-05-05T10:00:00Z'),
        description: 'Fiber internet & electricity bills',
        contactId: null,
        invoiceId: null,
      },
      {
        type: 'EXPENSE',
        category: 'SALARIES',
        amount: 250000,
        date: new Date('2026-06-01T10:00:00Z'),
        description: 'Monthly employee payroll distribution',
        contactId: null,
        invoiceId: null,
      },
      {
        type: 'EXPENSE',
        category: 'RENT',
        amount: 50000,
        date: new Date('2026-06-02T10:00:00Z'),
        description: 'Co-working office rent (Delhi HQ)',
        contactId: null,
        invoiceId: null,
      },
      {
        type: 'EXPENSE',
        category: 'UTILITIES',
        amount: 14000,
        date: new Date('2026-06-05T10:00:00Z'),
        description: 'Office network, backup line & electricity bills',
        contactId: null,
        invoiceId: null,
      },
    ],
  });

  console.log('Transactions seeded.');

  // 7. Create Budgets
  await prisma.budget.createMany({
    data: [
      {
        category: 'SALARIES',
        amount: 300000,
        periodStart: new Date('2026-05-01T00:00:00Z'),
        periodEnd: new Date('2026-06-30T23:59:59Z'),
      },
      {
        category: 'RENT',
        amount: 60000,
        periodStart: new Date('2026-05-01T00:00:00Z'),
        periodEnd: new Date('2026-06-30T23:59:59Z'),
      },
      {
        category: 'MARKETING',
        amount: 80000,
        periodStart: new Date('2026-05-01T00:00:00Z'),
        periodEnd: new Date('2026-06-30T23:59:59Z'),
      },
      {
        category: 'UTILITIES',
        amount: 30000,
        periodStart: new Date('2026-05-01T00:00:00Z'),
        periodEnd: new Date('2026-06-30T23:59:59Z'),
      },
      {
        category: 'VENDOR_PAYMENTS',
        amount: 150000,
        periodStart: new Date('2026-05-01T00:00:00Z'),
        periodEnd: new Date('2026-06-30T23:59:59Z'),
      },
    ],
  });

  console.log('Budgets seeded.');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
