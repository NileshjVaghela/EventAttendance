# Event Attendance System

A lightweight, serverless event attendance system built on AWS. Attendees scan venue-displayed QR codes and self-identify using a sequence number + email OTP verification. Also tracks breakout session attendance for reward eligibility.

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
- Desk staff read-only access
- Reports with per-column search, date filter, pagination
- Auto-refreshing attendee status (5s interval)
- Rate-limited OTP (max 5 total, max 3 per 10 min)
- Event activation control (check-in blocked until event is active)

## Project Structure

```
├── infra/                  # AWS CDK infrastructure
│   ├── bin/app.ts
│   └── lib/event-attendance-stack.ts
├── src/
│   ├── functions/          # Lambda functions
│   │   ├── admin/index.ts      # Admin CRUD, QR, reports
│   │   ├── checkin/index.ts    # Public: sequence → OTP → verify
│   │   ├── session/index.ts    # Public: session attendance
│   │   └── shared/             # DynamoDB client, OTP utils, email
│   └── frontend/           # React SPA
│       └── src/
│           ├── pages/          # CheckinPage, SessionPage, AdminLogin, AdminDashboard
│           ├── utils/api.ts    # API client with auth
│           └── styles.css
└── docs/                   # User manuals & requirements
```

## Prerequisites

- AWS Account with CDK bootstrapped
- Node.js 20+
- Docker (for builds)
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

### 3. Create Admin User

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

### 4. Build & Deploy Functions

```bash
cd src/functions
npm install
npx tsc
cp package.json dist/
cd dist && npm install --omit=dev
```

Then re-run `cdk deploy` to update Lambda code.

### 5. Build & Deploy Frontend

```bash
cd src/frontend
cp .env.example .env  # Fill in your values
npm install
npx vite build
aws s3 sync dist/ s3://<frontend-bucket>/ --delete
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

## User Roles

| Role | Access |
|------|--------|
| Admin | Full CRUD, reports, user management |
| Staff | Read-only: view attendees, search, reports |
| Attendee | Public: check-in via OTP, session attendance |

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Admin Manual](docs/USER-MANUAL-ADMIN.md)
- [Attendee Manual](docs/USER-MANUAL-ATTENDEE.md)
- [Desk Staff Manual](docs/USER-MANUAL-DESK-STAFF.md)

## License

Private — All rights reserved.
