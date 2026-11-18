import {
  getRequestBody,
  sendJson,
  serializeCookie,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_MAX_AGE,
  isSecureConnection,
} from '../_lib/authUtils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const { code, redirect_uri } = await getRequestBody(req);

    if (!code) {
      return sendJson(res, 400, { error: 'Missing authorization code' });
    }

    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
      return sendJson(res, 500, {
        error: 'Server misconfiguration: VITE_GOOGLE_CLIENT_ID is not configured.',
      });
    }

    if (!clientSecret) {
      return sendJson(res, 500, {
        error:
          'Server misconfiguration: GOOGLE_CLIENT_SECRET is missing. Please set GOOGLE_CLIENT_SECRET in your environment or Vercel project settings.',
      });
    }

    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri || 'postmessage',
      grant_type: 'authorization_code',
    });

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

