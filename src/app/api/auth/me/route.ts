import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const id = request.headers.get('x-user-id');
  const email = request.headers.get('x-user-email');
  const role = request.headers.get('x-user-role');
  const name = request.headers.get('x-user-name');

  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    user: { id, email, role, name },
  });
}
