import {
  parseCookies,
  getRequestBody,
  sendJson,
  serializeCookie,
  encryptPayload,
  decryptPayload,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_MAX_AGE,
  isSecureConnection,
} from '../_lib/authUtils';

export default async function handler(req: any, res: any) {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    return sendJson(res, 500, {
      error: 'Server misconfiguration: GOOGLE_CLIENT_SECRET is missing for pairing encryption.',
    });
  }

  // GET: Generate stateless encrypted pairing token from existing Safari/browser session
  if (req.method === 'GET') {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const refreshToken = cookies[REFRESH_COOKIE_NAME];

      if (!refreshToken) {
        return sendJson(res, 401, {
          error: 'No active session found in this browser. Please sign in to TrackWise before pairing.',
        });
      }

      // 2-minute expiration for secure one-time pairing
      const pairingPayload = {
        refresh_token: refreshToken,
        exp: Date.now() + 120000,
      };

      const pairingToken = encryptPayload(pairingPayload, clientSecret);

      return sendJson(res, 200, {
        pairingToken,
        expiresIn: 120,
      });
    } catch (err: any) {
      return sendJson(res, 500, {
        error: err.message || 'Failed to generate pairing token',
      });
    }
  }

  // POST: Receive pairing token inside standalone iOS PWA container and set HttpOnly cookie
  if (req.method === 'POST') {
    try {
      const { pairingToken } = await getRequestBody(req);

      if (!pairingToken || typeof pairingToken !== 'string') {
        return sendJson(res, 400, { error: 'Missing or invalid pairing token' });
      }

      let payload: { refresh_token: string; exp: number };
      try {
        payload = decryptPayload(pairingToken.trim(), clientSecret);
      } catch {
        return sendJson(res, 400, {
          error: 'Invalid or tampered pairing token. Please generate a new code in your browser.',
        });
      }

      if (!payload.exp || Date.now() >= payload.exp) {
        return sendJson(res, 400, {
          error: 'Pairing token has expired (2-minute window). Please generate a fresh code.',
        });
      }

      if (!payload.refresh_token) {
        return sendJson(res, 400, { error: 'Malformed pairing token payload' });
      }

      // Set HttpOnly refresh cookie inside the PWA container
      const cookieStr = serializeCookie(REFRESH_COOKIE_NAME, payload.refresh_token, {
        path: '/api/auth',
        httpOnly: true,
        secure: isSecureConnection(req),
        sameSite: 'Lax',
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });

      res.setHeader('Set-Cookie', [cookieStr]);

      return sendJson(res, 200, {
        success: true,
        message: 'PWA container paired successfully.',
      });
    } catch (err: any) {
      return sendJson(res, 500, {
        error: err.message || 'Failed to verify pairing token',
      });
    }
  }

  return sendJson(res, 405, { error: 'Method Not Allowed' });
}

