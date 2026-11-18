import {
  parseCookies,
  sendJson,
  serializeCookie,
  REFRESH_COOKIE_NAME,
  isSecureConnection,
} from '../_lib/authUtils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
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

