const REFRESH_COOKIE_NAME = 'trackwise_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180 days in seconds

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

async function getRequestBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
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
    const { code, redirect_uri, code_verifier } = await getRequestBody(req);

    if (!code) {
      return sendJson(res, 400, { error: 'Missing authorization code' });
    }

    const clientId =
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
      return sendJson(res, 500, {
        error:
          'Server configuration error: VITE_GOOGLE_CLIENT_ID is not configured in Vercel environment variables.',
      });
    }

    if (!clientSecret) {
      return sendJson(res, 500, {
        error:
          'Server configuration error: GOOGLE_CLIENT_SECRET is missing. Please add GOOGLE_CLIENT_SECRET in your Vercel Project Settings -> Environment Variables.',
      });
    }

    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri || 'postmessage',
      grant_type: 'authorization_code',
    });

    if (code_verifier) {
      tokenParams.set('code_verifier', code_verifier);
    }

    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await googleResponse.json();

    if (!googleResponse.ok || tokenData.error) {
      const errorMsg =
        tokenData.error_description || tokenData.error || 'Failed to exchange authorization code';
      return sendJson(res, googleResponse.status || 400, { error: errorMsg });
    }

    const { access_token, expires_in, refresh_token } = tokenData;

    const cookieHeaders: string[] = [];

    if (refresh_token) {
      const cookieStr = serializeCookie(REFRESH_COOKIE_NAME, refresh_token, {
        path: '/api/auth',
        httpOnly: true,
        secure: isSecureConnection(req),
        sameSite: 'Lax',
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });
      cookieHeaders.push(cookieStr);
    }

    if (cookieHeaders.length > 0) {
      res.setHeader('Set-Cookie', cookieHeaders);
    }

    return sendJson(res, 200, {
      access_token,
      expires_in: expires_in || 3599,
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      error: err.message || 'Internal server error during token exchange',
    });
  }
}
