/**
 * Centralized security header configuration shared across dev tooling and tests.
 */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;

export const CSP_POLICY = `
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' https: data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
`
  .replace(/\n/g, "")
  .replace(/\s+/g, " ")
  .trim();

export const PERMISSIONS_POLICY = `
  camera=(),
  microphone=(),
  geolocation=(),
  usb=(),
  magnetometer=(),
  gyroscope=(),
  accelerometer=()
`
  .replace(/\n/g, "")
  .replace(/\s+/g, " ")
  .trim();

/**
 * Returns all recommended HTTP security headers.
 */
export const getSecurityHeaders = () => ({
  ...SECURITY_HEADERS,
  "Content-Security-Policy": CSP_POLICY,
  "Permissions-Policy": PERMISSIONS_POLICY,
});
