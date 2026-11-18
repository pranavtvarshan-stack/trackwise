const REFRESH_COOKIE_NAME = 'trackwise_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180 days in seconds

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

    if (!refreshToken) {
      return sendJson(res, 401, {
        error: 'No active session or refresh token found. Please sign in again.',
      });
    }

    const clientId =
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return sendJson(res, 500, {
        error:
          'Server configuration error: GOOGLE_CLIENT_SECRET or VITE_GOOGLE_CLIENT_ID missing in Vercel environment variables.',
      });
    }

    const refreshParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: refreshParams.toString(),
    });

    const tokenData = await googleResponse.json();

    if (!googleResponse.ok || tokenData.error) {
      const errorMsg =
        tokenData.error_description || tokenData.error || 'Failed to refresh access token';
      return sendJson(res, googleResponse.status || 401, { error: errorMsg });
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } = tokenData;

    // Google occasionally issues a rotated refresh token
    if (newRefreshToken) {
      const cookieStr = serializeCookie(REFRESH_COOKIE_NAME, newRefreshToken, {
        path: '/api/auth',
        httpOnly: true,
        secure: isSecureConnection(req),
        sameSite: 'Lax',
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });
      res.setHeader('Set-Cookie', [cookieStr]);
    }

    return sendJson(res, 200, {
      access_token,
      expires_in: expires_in || 3599,
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      error: err.message || 'Internal server error during silent token refresh',
    });
  }
}
