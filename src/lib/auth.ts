import crypto from 'crypto';

const SALT = process.env.AUTH_SALT || 'vriddhi_salt_2026_default';
const JWT_SECRET = process.env.JWT_SECRET || 'vriddhi_jwt_secret_key_2026_default';

/**
 * Hashes a plain password using PBKDF2 with SHA-512
 */
export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 1000, 64, 'sha512').toString('hex');
}

/**
 * Generates a signed JWT-like token
 */
export function generateToken(payload: { id: string; email: string; role: string; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  
  // Token expires in 24 hours
  const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const payloadStr = Buffer.from(JSON.stringify({ ...payload, exp: expiry })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');
    
  return `${header}.${payloadStr}.${signature}`;
}

/**
 * Verifies a JWT-like token and returns the payload if valid
 */
export function verifyToken(token: string): { id: string; email: string; role: string; name: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payloadStr, signature] = parts;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payloadStr}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch (e) {
    return null;
  }
}
