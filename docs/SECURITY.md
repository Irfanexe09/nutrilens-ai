# NutriLens Security Policy & Architecture Guarantees

## 1. Supported Versions

| Version | Supported | Security Notes |
| :--- | :---: | :--- |
| `0.2.x` | Yes | Production readiness & hardened security baseline |
| `< 0.2.0` | No | Prototype phases; upgrade recommended |

---

## 2. Core Security Architecture & Defense-in-Depth

NutriLens implements a defense-in-depth model across five architectural layers:

### 2.1 Multimodal AI Isolation & Nutrition Engine Determinism
- **Principle**: The Vision LLM is strictly an identification and volume-estimation assistant. It never calculates nutritional totals or assigns calorie values.
- **Integrity Guarantee**: All macronutrient and energy numbers are deterministically computed by the Python Nutrition Engine against verified reference values. AI prompt responses cannot directly update or alter the reference database.

### 2.2 Image Pipeline & Decompression Bomb Protection
- **Pillow Protection**: Pillow pixel limits are capped at `MAX_IMAGE_PIXELS = 25,000,000` (25 megapixels) to prevent decompression bomb denial-of-service (DoS) memory exhaustion attacks.
- **Format Verification**: Two-tier verification verifies both MIME header declarations and actual decoded image headers (`JPEG`, `PNG`, `WEBP`), eliminating polyglot file uploads.
- **Safe Storage**: Uploaded files receive isolated UUID filenames and whitelisted extensions, preventing path traversal (`../`).
- **Transient Retention**: Uploaded meal images are purged automatically after 24 hours.

### 2.3 Authentication & Object-Level Authorization (IDOR)
- **Password Hashing**: Passwords are hashed using PBKDF2 with HMAC-SHA256, 100,000 iterations, and random 16-byte cryptographic salts. Hash verification uses constant-time `secrets.compare_digest`.
- **Identity Isolation**: All meal records, user profiles, optimization candidates, and daily tracking records enforce user ownership. Unauthenticated requests to private meals return `401 Unauthorized`; cross-user tampering returns `403 Forbidden`.
- **User Spoofing Defense**: Client payloads cannot set or override `user_id`; identity is derived strictly from the verified JWT bearer token.

### 2.4 Rate Limiting & Resource Protection
- **Sliding Window Rate Limiter**: Multi-modal vision analysis (`/api/analyze`) is protected by an in-memory sliding window rate limiter (15 requests/minute per client IP), preventing abuse, quota exhaustion, and runaway API costs.

### 2.5 Error Sanitization & Information Leakage Prevention
- **Generic 500 Responses**: Unhandled exceptions and database errors are intercepted by global exception handlers, logging full diagnostics to server logs while returning generic error descriptions to API clients without leaking stack traces or internal server paths.

---

## 3. Secret Management & Key Rotation

1. **Production Secret Enforcement**: In `ENVIRONMENT=production`, NutriLens validates that default placeholder secrets cannot be used.
2. **Key Rotation Guidelines**:
   - To rotate `JWT_SECRET_KEY`, generate a new secret via `openssl rand -hex 32`. Existing user sessions will expire and require re-authentication.
   - To rotate `GEMINI_API_KEY`, update the environment variable on the deployment host and restart the container stack (`docker compose up -d`).

---

## 4. Reporting a Vulnerability

If you discover a security vulnerability within NutriLens, please submit a report to the repository maintainers. Please do not disclose vulnerabilities publicly until a fix has been verified and released.
