export const secure = () => process.env.NODE_ENV === 'production';
export const webOrigin = () => process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173';
export const cookieOptions = (maxAge?: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: secure(), path: '/', ...(maxAge ? { maxAge } : {}) });

const RETURN_TO = /^\/(?:s\/[A-Za-z0-9_-]{8,32})?$/;
/** Where to land after an OAuth round trip. Only the home page and share pages are allowed, so this can never become an open redirect. */
export const safeReturnTo = (value: unknown) => typeof value === 'string' && RETURN_TO.test(value) ? value : '/';

/** Redirect target in the web app, optionally carrying an `authError` code that the client turns into a message. */
export const appUrl = (returnTo: string, authError?: string) => `${webOrigin()}${returnTo}${authError ? `?authError=${authError}` : ''}`;
