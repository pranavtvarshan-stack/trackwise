const REFRESH_COOKIE_NAME = 'trackwise_refresh_token';

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (!name) return;
    const value = parts.slice(1).join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

function serializeCookie(
  name: string,
  val: string,
  options: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
  } = {}
): string {
  const parts = [`${name}=${encodeURIComponent(val)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join('; ');
}

function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function isSecureConnection(req: any): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const proto = req.headers?.['x-forwarded-proto'];
  if (proto === 'https') return true;
  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const cookies = parseCookies(req.headers?.cookie);
    const refreshToken = cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      // Best-effort revocation with Google OAuth server
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Continue even if revocation fails
      }
    }

    // Clear the HttpOnly cookie
    const clearCookie = serializeCookie(REFRESH_COOKIE_NAME, '', {
      path: '/api/auth',
      httpOnly: true,
      secure: isSecureConnection(req),
      sameSite: 'Lax',
      maxAge: 0,
    });

    res.setHeader('Set-Cookie', [clearCookie]);

    return sendJson(res, 200, { success: true });
  } catch (err: any) {
    return sendJson(res, 500, {
      error: err.message || 'Internal error during logout',
    });
  }
}
