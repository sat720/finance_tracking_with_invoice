import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  let user: { id: string; name: string; email: string; role: string } | null = null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = parts[1];
      user = JSON.parse(decodeBase64Url(payloadStr));
    }
  } catch (e) {
    console.error('Failed to parse auth token in layout:', e);
    redirect('/login');
  }

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="app-container">
      <Sidebar user={user} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
