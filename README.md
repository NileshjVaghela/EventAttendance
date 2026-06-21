# Event Attendance System

A lightweight, serverless event attendance system built on AWS. Attendees scan venue-displayed QR codes and self-identify using a sequence number + email OTP verification. Also tracks breakout session attendance for reward eligibility.

## What is Event Attendance System?

Event Attendance System is a self-service check-in and session tracking platform designed for conferences, tech events, and workshops. Instead of staff manually scanning badges, attendees scan a QR code displayed at the venue and verify themselves using their registered email — no app install required.

### How It Works

**For Attendees:**
1. Walk up to the registration desk and scan the QR code with your phone camera
2. Enter your sequence number (provided during registration)
3. Receive a one-time code on your registered email
4. Show the verification screen to desk staff — done!

For breakout sessions, simply scan the session QR displayed on stage and enter your sequence number. No OTP needed — it's instant.

**For Event Organizers:**
- Upload attendee lists via CSV
- Generate QR codes for check-in desks and breakout sessions
- Track real-time attendance and session participation
- Set reward thresholds (e.g., "attend 8 of 10 sessions to win swag")
- Export reports for post-event analysis

**For Desk Staff:**
- View check-in status in real-time
- Search attendees by name, sequence number, or company
- Monitor session attendance counts

### Key Benefits

- **Zero friction** — works in any mobile browser, no app download
- **Scalable** — handles 1200+ concurrent attendees without degradation
- **Secure** — email OTP verification, server-side captcha, optional MFA for admins
- **Real-time** — instant check-in status updates for staff
- **Cost-effective** — fully serverless, ~$10 per event on AWS

---

## Architecture

- **Frontend:** React 18 + Vite → S3 + CloudFront
- **API:** Amazon API Gateway (REST)
- **Compute:** AWS Lambda (Node.js 20)
- **Database:** Amazon DynamoDB (single-table design)
- **Auth:** Amazon Cognito
- **Email:** Amazon SES (OTP delivery)
- **IaC:** AWS CDK (TypeScript)

## Features

- QR-based self-service check-in with email OTP verification
- Breakout session attendance tracking (time-window enforced)
- Admin panel: event/attendee/session CRUD, QR generation, reports
- **Server-side captcha** on admin login (math challenge stored in DynamoDB)
- **Optional email MFA** for admin accounts (enable/disable per user)
- **Desk staff role enforcement** — read-only access restricted to assigned events
- **User management UI** — create/delete admin & desk staff, assign events
- **Fullscreen QR display** — click QR to go fullscreen, Escape to exit
- **Short URL codes** — 9-char alphanumeric fallback if QR scanning fails
- Reports with CSV export
- Rate-limited OTP (max 5 total, max 3 per 10 min)
- Event activation control (check-in blocked until event is active)

## Project Structure

```
├── infra/                  # AWS CDK infrastructure
│   ├── bin/app.ts
│   └── lib/event-attendance-stack.ts
├── src/
│   ├── functions/          # Lambda functions
│   │   ├── admin/index.ts      # Admin CRUD, QR, reports, user mgmt, MFA
│   │   ├── checkin/index.ts    # Public: captcha, short URLs, sequence → OTP → verify
│   │   ├── session/index.ts    # Public: session attendance
│   │   └── shared/             # DynamoDB client, OTP utils, email
│   └── frontend/           # React SPA
│       └── src/
│           ├── pages/
│           │   ├── AdminDashboard.tsx   # Event management, QR display
│           │   ├── AdminLogin.tsx       # Login with captcha + MFA
│           │   ├── CheckinPage.tsx      # Attendee check-in flow
│           │   ├── SessionPage.tsx      # Session attendance
│           │   ├── UsersPage.tsx        # User & staff management
│           │   └── ShortRedirect.tsx    # Short URL resolver
│           ├── utils/api.ts
│           └── styles.css
└── docs/                   # User manuals & requirements
```

## Prerequisites

- AWS Account with CDK bootstrapped
- Node.js 20+
- Docker (for builds — all build/test/deploy runs in Docker containers)
- AWS CLI configured

## Deployment

### 1. Deploy Infrastructure

```bash
cd infra
npm install
npx cdk deploy --all
```

Note the outputs: API URL, CloudFront URL, User Pool ID, Client ID.

### 2. Configure SES

Verify sender and recipient emails in SES (required in sandbox mode):
```bash
aws ses verify-email-identity --email-address your-sender@domain.com
```

### 3. Create Initial Admin User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username admin@domain.com \
  --user-attributes Name=email,Value=admin@domain.com Name=email_verified,Value=true Name=custom:role,Value=admin

aws cognito-idp admin-set-user-password \
  --user-pool-id <USER_POOL_ID> \
  --username admin@domain.com \
  --password 'YourPassword@123' \
  --permanent
```

After this, additional users can be managed via the Admin UI → Users page.

### 4. Build & Deploy Functions (via Docker)

```bash
docker run --rm -v $(pwd):/app -w /app/src/functions node:20-alpine sh -c "npm install && npm run build"
```

Then re-run `cdk deploy` to update Lambda code.

### 5. Build & Deploy Frontend (via Docker)

```bash
cd src/frontend
cp .env.example .env  # Fill in your values

docker run --rm -v $(pwd):/app -w /app/src/frontend node:20-alpine sh -c "npm install && npm run build"
aws s3 sync src/frontend/dist/ s3://<frontend-bucket>/ --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=https://xxx.execute-api.region.amazonaws.com/prod
VITE_USER_POOL_ID=region_xxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxx
```

### Lambda (set by CDK)
```
TABLE_NAME, ASSETS_BUCKET, USER_POOL_ID, USER_POOL_CLIENT_ID, SES_FROM_EMAIL, FRONTEND_URL
```

## API Endpoints

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | /captcha | Generate math captcha challenge |
| POST | /captcha/verify | Validate captcha answer |
| GET | /s/{code} | Resolve short URL code |
| POST | /checkin/verify-sequence | Validate sequence, send OTP |
| POST | /checkin/verify-otp | Verify OTP, return attendee info |
| POST | /session/attend | Record session attendance |

### Admin (Cognito-protected)
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | /admin/events | Create/list events |
| GET/PUT/DELETE | /admin/events/{id} | Event CRUD |
| GET/POST | /admin/events/{id}/attendees | List/upload attendees |
| GET | /admin/events/{id}/attendees/search | Search by name/seq/company |
| POST/GET | /admin/events/{id}/sessions | Create/list sessions |
| GET | /admin/events/{id}/qr | Generate check-in QR + short URL |
| GET | /admin/events/{id}/sessions/{sid}/qr | Generate session QR + short URL |
| GET | /admin/events/{id}/reports/* | Check-in, session, rewards, export |
| POST | /admin/staff/assign | Assign desk staff to event |
| POST | /admin/staff/unassign | Remove assignment |
| GET | /admin/staff/assignments | List assignments |
| POST | /admin/staff/users | User management (create/list/delete/enable-mfa/disable-mfa) |
| POST | /admin/staff/mfa | MFA operations (check/send/verify) |

## User Roles

| Role | Access |
|------|--------|
| Admin | Full CRUD, reports, user management, MFA control |
| Staff/Deskstaff | Read-only on assigned events: attendees, search, reports |
| Attendee | Public: check-in via OTP, session attendance |

## DynamoDB Schema (Single Table)

| Entity | PK | SK |
|--------|----|----|
| Event | `EVENT#<eventId>` | `#METADATA` |
| Attendee | `EVENT#<eventId>` | `ATTENDEE#<seq>` |
| Session | `EVENT#<eventId>` | `SESSION#<sessionId>` |
| Attendance | `EVENT#<eventId>#ATT#<seq>` | `SESSION#<sessionId>` |
| OTP | `OTP#<eventId>#<seq>` | `#LATEST` |
| Captcha | `CAPTCHA#<id>` | `#CHALLENGE` |
| Staff Assignment | `STAFF#<email>` | `EVENT#<eventId>` |
| User MFA Config | `USERMFA#<email>` | `#CONFIG` |
| MFA OTP | `MFA_OTP#<email>` | `#LATEST` |
| Short URL | `SHORT#<code>` | `#REDIRECT` |

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Admin Manual](docs/USER-MANUAL-ADMIN.md)
- [Attendee Manual](docs/USER-MANUAL-ATTENDEE.md)
- [Desk Staff Manual](docs/USER-MANUAL-DESK-STAFF.md)

## License

Apache 2 License.
