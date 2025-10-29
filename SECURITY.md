# 🔐 TWINLOGY IDN - Security Features

## Security Enhancements Implemented

### 1. HTTP Security Headers (Helmet.js)
- **Content Security Policy (CSP)** - Prevents XSS attacks
- **X-Frame-Options** - Prevents clickjacking
- **X-Content-Type-Options** - Prevents MIME sniffing
- **Strict-Transport-Security** - Forces HTTPS
- **X-DNS-Prefetch-Control** - Controls DNS prefetching

### 2. Rate Limiting
Protects against DDoS and brute force attacks:

**API Endpoints:**
- 30 requests/minute per IP
- Applies to: `/data`, `/search`

**Ingest Endpoint:**
- 100 requests/15 minutes per IP
- Applies to: `/ingest`

### 3. CORS Configuration
- **Production**: Whitelist specific domains only
- **Development**: Allow all origins for testing
- **Credentials**: Enabled for cookie/auth support
- **Max Age**: 24 hours cache

### 4. Input Validation
All `/ingest` POST data is validated:
- ✅ Temperature: -50°C to 60°C
- ✅ Humidity: 0% to 100%
- ✅ Latitude: -90° to 90°
- ✅ Longitude: -180° to 180°
- ✅ Sensor ID: Required string
- ✅ Timestamp: Valid ISO8601 format

### 5. Payload Size Limits
- JSON body: Max 10KB
- URL encoded: Max 10KB
- Prevents memory exhaustion attacks

### 6. Map Bounds Restriction
- Geographic bounds limited to Indonesia
- Prevents infinite scrolling/panning
- Optimizes performance

---

## Security Best Practices

### For Production:

1. **Environment Variables**
   ```env
   NODE_ENV=production
   ALLOWED_ORIGINS=https://twinlogy-idn.com
   ```

2. **SSL/TLS**
   - Use Let's Encrypt for trusted certificates
   - Force HTTPS redirect
   - Enable HSTS

3. **Database Security**
   - Use environment variables for credentials
   - Enable encryption at rest
   - Regular backups

4. **Monitoring**
   - Log all failed authentication attempts
   - Monitor rate limit violations
   - Set up alerts for suspicious activity

5. **Updates**
   - Keep dependencies updated
   - Regular security audits: `npm audit`
   - Update Node.js to LTS version

---

## Vulnerability Reporting

If you discover a security vulnerability:
1. Do NOT open a public issue
2. Contact: security@twinlogy-idn.com
3. Provide detailed description
4. Allow 90 days for fix before disclosure

---

## Security Checklist

- [x] HTTPS enabled
- [x] Security headers configured
- [x] Rate limiting active
- [x] Input validation
- [x] CORS properly configured
- [x] Payload size limits
- [x] Map bounds restricted
- [x] Dependencies up-to-date
- [ ] Database encryption (when implemented)
- [ ] User authentication (future feature)
- [ ] API key management (future feature)

---

## Dependencies Security

Run regular security audits:
```bash
npm audit
npm audit fix
```

Current security packages:
- `helmet@^7.1.0` - HTTP headers
- `express-rate-limit@^7.1.5` - Rate limiting
- `cors@^2.8.5` - CORS management
- `express-validator@^7.0.1` - Input validation

---

**Last Updated:** 2025-10-29
**Security Level:** Production-Ready ✅
