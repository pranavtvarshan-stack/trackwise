import {
  parseCookies,
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
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return sendJson(res, 401, {
        error: 'No active session or refresh token found. Please sign in again.',
      });
    }

    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return sendJson(res, 500, {
        error: 'Server misconfiguration: Google OAuth credentials missing.',
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
      // If refresh token is revoked or expired
      if (tokenData.error === 'invalid_grant') {
        // Clear stale cookie
        const clearCookie = serializeCookie(REFRESH_COOKIE_NAME, '', {
          path: '/api/auth',
          httpOnly: true,
          secure: isSecureConnection(req),
          sameSite: 'Lax',
          maxAge: 0,
        });
        res.setHeader('Set-Cookie', [clearCookie]);
      }
      return sendJson(res, googleResponse.status || 401, {
        error: tokenData.error_description || tokenData.error || 'Failed to refresh access token',
      });
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } = tokenData;

    // If Google returned a rotated refresh token, update the cookie
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
      error: err.message || 'Internal server error during token refresh',
    });
  }
}

