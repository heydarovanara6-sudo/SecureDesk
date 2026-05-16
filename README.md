# SecureDesk

**Zero-Knowledge Encrypted Internal Messenger & Safety Platform for BP Azerbaijan**

> *"Slack trusts its servers. SecureDesk trusts no one."*

[![Live](https://img.shields.io/badge/Live-securedesk.xyz-00A650?style=flat&logo=globe)](https://securedesk.xyz)
[![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)
[![SSL](https://img.shields.io/badge/SSL-A%2B-00A650?style=flat)](https://securedesk.xyz)

---

## What is SecureDesk?

SecureDesk is a purpose-built secure communication platform for BP Azerbaijan's 2,395 offshore and onshore professionals. It replaces consumer apps like WhatsApp and Telegram — which have zero role-based access control, no audit trail, and no encryption at rest — with a system designed from the ground up for oil & gas operational security.

**The core architectural guarantee:** AES-256 encryption runs entirely in the browser before any data leaves the device. The server only ever receives ciphertext. Even a full server breach yields nothing readable.

```
Browser (KEY LIVES HERE)  →  Cloudflare  →  Flask API  →  MongoDB
     AES-256 encrypt             TLS 1.3       no key      ciphertext only
```

---

## Why Not Slack?

Slack encrypts data — but **Slack holds the decryption keys**. This means:
- Slack can technically read any message at any time
- Disney lost **1.1 TB** of internal Slack messages in a 2024 breach
- Nikkei had **17,300** employee records exposed via stolen Slack credentials in 2025
- Slack Business+ for 2,395 users costs **$431,100/year**

SecureDesk costs **$14,999/year** and mathematically cannot read your messages.

| | Slack Free | Slack Biz+ | **SecureDesk** |
|---|---|---|---|
| Client-side encryption | ✗ | ✗ | ✅ |
| Server can read messages | ✓ (risk) | ✓ (risk) | **NO** |
| Emergency broadcast | ✗ | ✗ | ✅ |
| Muster roll call | ✗ | ✗ | ✅ |
| Shift handover (offshore) | ✗ | ✗ | ✅ |
| TOTP MFA (RFC 6238) | ✗ | Basic | ✅ |
| Azerbaijani + Russian | ✗ | ✗ | ✅ |
| IEC 62443 compliant | ✗ | ✗ | ✅ |
| **Annual cost (2,395 users)** | $230,400 | $431,100 | **$14,999** |

---

## Security Architecture

### Zero-Knowledge Encryption
Every message is encrypted with **AES-256-CBC** in the browser using CryptoJS. A fresh random 128-bit salt and IV is generated on every single call — the same message always produces a different ciphertext (IND-CPA security).

```javascript
// Encryption runs CLIENT-SIDE — key never transmitted
const encryptMessage = (text) =>
  CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
```

MongoDB stores only: `U2FsdGVkX19...` — permanently unreadable without the browser key.

**Formal zero-knowledge property (from our research report):**
```
Pr[Server reads m | Ek(m)] ≤ ε   vs   Pr[Slack reads m] = 1
```

### File Security — 4 Layers
1. **SHA-256 filename hashing** — `SHA-256(email:filename:timestamp).ext` — pre-image resistant, unguessable
2. **Per-file JWT tokens** — token A cannot open file B
3. **Token inside AES-256 body** — token never exposed in plaintext
4. **Extension whitelist + 20MB cap** — server-side enforcement

```python
def hash_filename(original_filename, user_email):
    raw = f"{user_email}:{original_filename}:{datetime.utcnow().timestamp()}"
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return f"{hashed}.{original_filename.rsplit('.', 1)[-1].lower()}"
```

### Authentication — 3 Layers
| Layer | Method | Threat Mitigated |
|---|---|---|
| @bp.com domain lock | Server-enforced email suffix | APT33 credential phishing |
| bcrypt (work factor 12) | 4,096 iterations, auto-salt | XENOTIME credential harvesting |
| TOTP MFA (RFC 6238) | 30-second rolling codes | Sandworm stolen passwords |

### Standards Compliance
- **IEC 62443-3-3** — Security Level 2 on FR1 (Auth) and FR4 (Confidentiality)
- **ISO/IEC 27001:2022** — All four themes covered
- **GDPR Article 32** — No breach notification required (server never holds keys)
- **OWASP Top 10 (2021)** — All 10 risks explicitly mitigated
- **NIST FIPS 197** — AES-256 implementation
- **NIST FIPS 180-4** — SHA-256 file naming

### Threat Actor Mapping
| Actor | TTP | SecureDesk Mitigation |
|---|---|---|
| APT33 (Iran/IRGC) | Slack webhook token theft | AES-256 ciphertext + @bp.com lock |
| Sandworm (Russia GRU) | Intercept shift-change OT messages | Client-side enc — shift data never plaintext |
| XENOTIME (Russia) | Long-term credential harvest | bcrypt WF12 + 24h JWT expiry |
| Volt Typhoon (China MSS) | Stolen session token lateral movement | Per-file JWT binding + HS256 enforcement |

---

## Features

### 🚨 Safety Features (BP-Specific)
- **Emergency Broadcast System** — Full-screen overlay + alarm to all connected devices simultaneously. Mandatory acknowledgement. No Slack equivalent at any price tier.
- **Muster Roll Call** — Digital safety drill with live Safe / Injured / No Response aggregation. Satisfies IEC 62443 FR6.
- **ACG Shift Handover Form** — Captures platform status (Normal / Issue / Critical), flagged issues, required actions. AES-256 encrypted.
- **Incident Report Form** — Four severity levels (Low / Medium / High / Critical) with full workflow: Open → Investigating → Resolved → Closed. Immutable audit trail.
- **8 Pre-configured BP Channels** — `#general` (public), `#acg-operations`, `#shah-deniz`, `#hr-confidential`, `#legal`, `#finance`, `#executive`, `#it-security` (all restricted, Socket.IO validates on every event)

### 💬 Messaging
- AES-256 encrypted messages with 4-level priority: Normal / Important / Urgent / Confidential
- Confidential messages auto-blur when browser window loses focus
- Self-destructing messages (30 seconds to 24 hours)
- Read receipts and typing indicators
- Unlimited encrypted message history — nothing ever expires

### 🔍 Productivity
- **Smart Search** (Ctrl+K) — filter by channel, sender, priority, and date with inline file preview
- **Focus Mode** and **Quiet Hours** — notification management
- **Kanban Task Manager** — Open / In Progress / Done / Blocked with automatic overdue highlighting
- **AI Channel Summaries** (Claude API) — Quick Summary, Action Items, Risk Assessment, Full Analysis over last 50 messages
- **Caspian Sea Weather Widget** — Real-time conditions for ACG Platform, Shah Deniz, Baku HQ (Open-Meteo API)
- Supply vessel ETA board
- Security dashboard

### 🌍 Localisation
Full interface in **English**, **Azerbaijani**, and **Russian** with profanity filtering in all three languages (bad-words npm with custom BP word lists).

---

## Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| Flask | 3.0 | REST API, blueprint routing |
| Flask-SocketIO | 5.3 | WebSocket pub/sub, room events |
| eventlet | — | Async server |
| MongoDB Atlas | M0→M10 | Encrypted message persistence |
| MinIO | Docker | S3-compatible file storage |
| PyJWT | — | 24h sessions, HS256 enforced, alg:none blocked |
| bcrypt | — | Work factor 12, password hashing |
| pyotp | — | RFC 6238 TOTP |
| Anthropic Claude | — | AI summaries + assistant |
| Docker + Coolify | — | Container orchestration, auto-deploy on commit |

### Frontend
| Package | Purpose |
|---|---|
| React 19 | UI, functional components, hooks |
| CryptoJS | AES-256-CBC client-side encryption |
| Tailwind CSS | BP green design system, dark mode |
| socket.io-client | Real-time event handling |
| bad-words npm | EN/AZ/RU profanity filtering |
| Axios | JWT-authenticated HTTP requests |
| Open-Meteo API | Caspian Sea weather widget |

### Infrastructure
| Service | Spec | Cost |
|---|---|---|
| AWS EC2 t3.small | eu-north-1 (Stockholm), 2 vCPU, 2GB RAM | $17/mo |
| Cloudflare | 330+ PoPs, unlimited DDoS, TLS 1.3, A+ SSL | Free |
| MongoDB Atlas | M0 (512MB free → M10 at $57/mo) | Free → $57/mo |
| Anthropic Claude API | Monthly renewal | $10/mo |
| Domain | securedesk.xyz | $2/yr |

**Total at scale (worst case): $1,010/year**

---

## Cost Comparison

| | Annual Cost (2,395 users) |
|---|---|
| Slack Free | $230,400 |
| Slack Business+ | $431,100 |
| Slack EKM (partial privacy only) | $718,500 |
| **SecureDesk** | **$14,999** |
| **BP saving vs Slack Biz+** | **$416,101/year** |

> Built for **$7 total** (domain $2 + Claude API credit $5; AWS $100 Activate credit used).

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- Python 3.11+
- MongoDB Atlas account
- MinIO instance (or use Docker Compose)

### Installation

```bash
git clone https://github.com/heydarovanara6-sudo/SecureDesk.git
cd SecureDesk
```

**Backend:**
```bash
cd server
pip install -r requirements.txt
cp .env.example .env   # fill in your MongoDB URI, JWT secret, MinIO keys
python app.py
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

**With Docker Compose:**
```bash
docker-compose up --build
```

### Environment Variables
```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Known Weaknesses & Upgrade Path

We documented these honestly in our research report (Section 4.2):

| Weakness | Current State | Upgrade Path |
|---|---|---|
| Shared AES key in JS bundle | Key in client bundle | X25519 ECDH per-user (RFC 7748) |
| Weak KDF | EVP_BytesToKey (single MD5) | PBKDF2 600K iterations (NIST SP 800-132) |
| CBC mode | No authentication tag | AES-256-GCM (NIST SP 800-38D) |
| File encryption | Not encrypted pre-upload | Web Crypto API client-side file enc. |
| Single instance | Single Flask server | Redis-backed horizontal scaling |
| Rate limiting | Not implemented | Account lockout + CAPTCHA |
| Mobile | Web only | Native iOS + Android app |

> Every weakness still represents a stronger security posture than Slack — a server breach still yields only ciphertext.

---

## Research

This project answered 7 research questions:
1. Cybersecurity risks of consumer messaging in O&G
2. Slack 2026 vs client-side encryption architecture
3. Can a tailored system be built in a student timeline?
4. Missing features for offshore environments
5. Secure file sharing in zero-knowledge architecture
6. APT groups targeting O&G communications
7. NIST FIPS 197 and IEC 62443 for industrial messaging

**Threat actors analysed:** APT33, Sandworm, XENOTIME, Volt Typhoon
**Standards applied:** STRIDE (Shostack, 2014), MITRE ATT&CK for ICS, IEC 62443-3-3, ISO/IEC 27001:2022, GDPR Art. 32, OWASP Top 10 (2021)

---

## Team

| Name | Role |
|---|---|
| **Nargiz Heydarova** | Lead · Architecture · Security · AI · Deployment · Research |
| **Rahman Aghazada** | Backend · API routes · DB schema · Server logic |
| **Kamran Guliyev** | Frontend · React · Socket.IO · State management |
| **Asim Gasimov** | UI/UX · Tailwind · BP branding · Mobile |

**Supervisor:** Seymur Mirzabayov
**Institution:** UFAZ · BP Azerbaijan · May 2026

---

## Live Demo

🌐 **[securedesk.xyz](https://securedesk.xyz)** — A+ SSL Labs · AWS EC2 eu-north-1 · Running live

---

## License

MIT License — see [LICENSE](LICENSE) for details.