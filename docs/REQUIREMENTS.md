# Event Attendance System — Requirements Specification

**Version:** 1.0
**Date:** 2026-06-13
**Status:** Draft

---

## 1. Overview

A lightweight, serverless event attendance system that reverses the traditional QR-code check-in process. Instead of staff scanning attendee badges, attendees scan venue-displayed QR codes and self-identify using a short sequence number + email OTP verification.

The system also tracks breakout session attendance for multi-session technical events, enabling reward/swag eligibility based on participation.

---

## 2. Goals

- Eliminate bottleneck at registration desks (attendees self-verify)
- Track breakout session attendance without manual effort
- Provide real-time reporting on attendance and reward eligibility
- Support multiple events from a single platform
- Zero app install — works in mobile browser

---

## 3. Users & Roles

| Role | Description |
|------|-------------|
| **Admin** | Full access: creates events, uploads attendee lists, configures sessions, views reports, manages users |
| **Desk Staff** | View-only access: search attendees, view check-in status, view session attendance numbers/lists |
| **Attendee** | Scans QR codes, enters sequence number/OTP, views confirmation |

---

## 4. Functional Requirements

### 4.1 Admin Panel

| ID | Requirement |
|----|-------------|
| ADM-01 | Admin can create, edit, and delete events |
| ADM-02 | Admin can upload attendee list via CSV (fields: sequence number, name, email, designation, company) |
| ADM-03 | Admin can integrate with Konfhub API to import attendee data |
| ADM-04 | Admin can create breakout sessions with: name, date, start time, end time |
| ADM-05 | Admin can generate and download QR codes (check-in QR per event, session QR per session) |
| ADM-06 | Admin can set reward threshold (e.g., attend 8 of 10 sessions = eligible) |
| ADM-07 | Admin can view real-time attendance dashboard |
| ADM-08 | Admin can export attendance reports as CSV |
| ADM-09 | Admin can manage other admin users |
| ADM-10 | Admin login protected with simple captcha |
| ADM-11 | Admin authentication via Cognito (email + password) |
| ADM-12 | Optional MFA via email OTP (admin can enable/disable per account) |

### 4.1.1 Desk Staff Access

| ID | Requirement |
|----|-------------|
| DSK-01 | Desk staff can log in with Cognito (email + password + captcha) |
| DSK-02 | Desk staff can view list of attendees for assigned event |
| DSK-03 | Desk staff can search attendees by name, sequence number, or company |
| DSK-04 | Desk staff can view check-in status (who checked in, when) |
| DSK-05 | Desk staff can view breakout session attendance list and counts |
| DSK-06 | Desk staff cannot create/edit/delete events, sessions, or attendees |
| DSK-07 | Admin assigns desk staff to specific events |

### 4.2 Event Check-in (Part 1)

| ID | Requirement |
|----|-------------|
| CHK-01 | Registration desk displays a printed/screen QR code containing event check-in URL |
| CHK-02 | Attendee scans QR code — opens mobile web page (no app install) |
| CHK-03 | Attendee enters their 3-4 digit sequence number |
| CHK-04 | System validates sequence number exists for that event |
| CHK-05 | System sends 6-digit OTP to attendee's registered email via SES |
| CHK-06 | OTP is valid for 10 minutes |
| CHK-07 | Attendee enters OTP on the same page |
| CHK-08 | On valid OTP, system displays: Name, Designation, Company Name |
| CHK-09 | Displayed info is styled large/clear for desk staff to read from attendee's phone |
| CHK-10 | System marks attendee as "checked in" with timestamp |
| CHK-11 | If sequence number is invalid, show error: "Sequence number not found" |
| CHK-12 | If OTP is incorrect/expired, show error with option to resend |
| CHK-13 | Rate limit OTP requests: max 3 per sequence number per 10 minutes |

### 4.3 Breakout Session Attendance (Part 2)

| ID | Requirement |
|----|-------------|
| SES-01 | Each breakout session has a unique QR code displayed on stage/screen |
| SES-02 | QR code URL contains event ID and session ID |
| SES-03 | Attendee scans session QR — opens mobile web page |
| SES-04 | Attendee enters their sequence number only (no OTP) |
| SES-05 | System validates: sequence number exists AND session is currently active (within start/end time) |
| SES-06 | If session is not active (too early or ended), show error: "Session not active" |
| SES-07 | If valid, record attendance with timestamp |
| SES-08 | Show confirmation: "Attendance recorded for [Session Name]" |
| SES-09 | Prevent duplicate attendance (same attendee, same session) — show "Already recorded" |
| SES-10 | No OTP required for session attendance (speed over security) |

### 4.4 Reporting

| ID | Requirement |
|----|-------------|
| RPT-01 | Per-event check-in count (checked in vs total registered) |
| RPT-02 | Per-session attendance count |
| RPT-03 | Per-attendee: list of sessions attended with timestamps |
| RPT-04 | Reward eligibility report: attendees meeting threshold |
| RPT-05 | Export all reports as CSV |
| RPT-06 | Real-time updates (admin dashboard refreshes) |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Max 1200 concurrent attendees per event |
| NFR-02 | Check-in page load < 2 seconds |
| NFR-03 | OTP delivery < 30 seconds |
| NFR-04 | Session attendance recording < 1 second response |
| NFR-05 | System available 99.9% during event hours |
| NFR-06 | All data encrypted at rest (DynamoDB) and in transit (HTTPS) |
| NFR-07 | OTP stored hashed, auto-deleted via TTL after 10 minutes |
| NFR-08 | Admin sessions expire after 8 hours |
| NFR-09 | Mobile web UI works on iOS Safari, Android Chrome (latest 2 versions) |
| NFR-10 | No app installation required for attendees |
| NFR-11 | Fully serverless — no EC2/ECS instances |
| NFR-12 | Infrastructure as Code (AWS CDK) |
| NFR-13 | Manual fallback process available if system is down (out of scope for software) |

---

## 6. Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend (Admin + Attendee) | React 18 + Vite, hosted on S3 + CloudFront |
| API | Amazon API Gateway (REST) |
| Compute | AWS Lambda (Node.js 20) |
| Database | Amazon DynamoDB (on-demand, single-table) |
| Auth | Amazon Cognito (admin users, optional email MFA) |
| Captcha | Simple math/image captcha on admin login (client-side + server validation) |
| Email | Amazon SES (OTP delivery + admin MFA) |
| QR Generation | Lambda + `qrcode` npm package |
| File Storage | Amazon S3 (CSV uploads, generated QR images) |
| IaC | AWS CDK (TypeScript) |
| Monitoring | CloudWatch Logs + Metrics |

---

## 7. Data Model

### 7.1 Entities

**Event**
- eventId (UUID)
- name
- date
- location
- status (draft / active / completed)
- checkInQrUrl
- rewardThreshold (number of sessions)
- createdAt

**Attendee**
- eventId
- sequenceNumber (3-4 digits, unique within event)
- name
- email
- designation
- company
- checkedIn (boolean)
- checkedInAt (timestamp)

**Session**
- eventId
- sessionId (UUID)
- name
- date
- startTime
- endTime
- qrCodeUrl

**Attendance Record**
- eventId
- sequenceNumber
- sessionId
- recordedAt (timestamp)

**OTP**
- eventId
- sequenceNumber
- otpHash
- createdAt
- expiresAt (TTL)
- attempts (count)

### 7.2 DynamoDB Single-Table Design

| Entity | PK | SK |
|--------|----|----|
| Event | `EVENT#<eventId>` | `#METADATA` |
| Attendee | `EVENT#<eventId>` | `ATTENDEE#<seq>` |
| Session | `EVENT#<eventId>` | `SESSION#<sessionId>` |
| Attendance | `EVENT#<eventId>#ATT#<seq>` | `SESSION#<sessionId>` |
| OTP | `OTP#<eventId>#<seq>` | `#LATEST` |

**GSI-1 (Session attendance report):**
- PK: `EVENT#<eventId>#SESSION#<sessionId>`
- SK: `ATTENDEE#<seq>`

---

## 8. API Endpoints

### Admin APIs (Cognito-authenticated)

| Method | Path | Description |
|--------|------|-------------|
| POST | /admin/events | Create event |
| GET | /admin/events | List events |
| GET | /admin/events/{id} | Get event details |
| PUT | /admin/events/{id} | Update event |
| DELETE | /admin/events/{id} | Delete event |
| POST | /admin/events/{id}/attendees/upload | Upload CSV |
| GET | /admin/events/{id}/attendees | List attendees |
| GET | /admin/events/{id}/attendees/search | Search attendees (name/seq/company) |
| POST | /admin/events/{id}/sessions | Create session |
| GET | /admin/events/{id}/sessions | List sessions |
| PUT | /admin/events/{id}/sessions/{sid} | Update session |
| DELETE | /admin/events/{id}/sessions/{sid} | Delete session |
| GET | /admin/events/{id}/qr | Generate check-in QR |
| GET | /admin/events/{id}/sessions/{sid}/qr | Generate session QR |
| GET | /admin/events/{id}/reports/checkin | Check-in report |
| GET | /admin/events/{id}/reports/sessions | Session attendance report |
| GET | /admin/events/{id}/reports/rewards | Reward eligibility report |
| GET | /admin/events/{id}/reports/export | CSV export |

Note: Desk staff use the same GET/search endpoints. Authorization is role-based — desk staff are restricted to read/search operations on their assigned events only.

### Public APIs (no auth, rate-limited)

| Method | Path | Description |
|--------|------|-------------|
| POST | /checkin/verify-sequence | Validate sequence, send OTP |
| POST | /checkin/verify-otp | Verify OTP, return attendee info |
| POST | /session/attend | Record session attendance |

---

## 9. UI Screens

### Admin Panel
1. Login (with captcha)
2. MFA setup (optional, email OTP)
3. Dashboard (event list + quick stats)
4. Event detail (attendees, sessions, QR codes)
5. Attendee list (with check-in status + search)
6. Session management
7. Reports (with export)
8. User management (admin + desk staff)

### Desk Staff Panel
1. Login (with captcha)
2. Assigned event(s) view
3. Attendee list with search (by name, sequence number, company)
4. Check-in status view (real-time)
5. Session attendance list and counts

### Attendee Mobile Web
1. Check-in: Sequence number entry
2. Check-in: OTP entry
3. Check-in: Attendee info display (large, clear text)
4. Session: Sequence number entry
5. Session: Confirmation message

---

## 10. QR Code Specification

**Check-in QR content:**
```
https://<domain>/checkin?event=<eventId>
```

**Session QR content:**
```
https://<domain>/session?event=<eventId>&session=<sessionId>
```

QR codes are simple URLs. When scanned, they open the mobile browser directly to the relevant page with context pre-filled.

---

## 11. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Admin brute-force login | Captcha on login form + Cognito lockout (5 failed attempts) |
| Admin account compromise | Optional email MFA |
| Brute-force sequence numbers | Rate limiting on public APIs (API Gateway throttling) |
| OTP interception | OTP hashed in DB, 10-min expiry, max 3 attempts |
| Session spoofing | Time-bound validation (QR only works during session window) |
| Data exposure | Attendee info only shown after OTP verification |
| DDoS | CloudFront + API Gateway throttling + WAF (optional) |

---

## 12. Out of Scope (v1)

- Badge printing integration
- SMS OTP (email only)
- Offline mode / PWA
- Attendee self-registration
- Payment processing
- Multi-language support
- Push notifications

---

## 13. Future Enhancements (v2)

- Konfhub API real-time sync
- SMS OTP option
- Live session Q&A integration
- Attendee networking / profile sharing
- PWA with offline queue
- Analytics dashboard with charts

---

## 14. Success Criteria

- [ ] 1200 attendees can check in within 1 hour without system degradation
- [ ] Session QR codes correctly reject scans outside time window
- [ ] OTP emails delivered within 30 seconds
- [ ] Admin can set up a complete event in < 15 minutes
- [ ] Reports accurately reflect attendance data
- [ ] Total AWS cost per event < $10

---

## 15. Milestones

| Phase | Scope | Duration |
|-------|-------|----------|
| Phase 1 | CDK infrastructure + DynamoDB + API skeleton | 2 days |
| Phase 2 | Check-in flow (sequence → OTP → display) | 2 days |
| Phase 3 | Session attendance flow | 1 day |
| Phase 4 | Admin panel (event + attendee + session CRUD + captcha + MFA) | 3 days |
| Phase 5 | QR generation + reporting + CSV export | 2 days |
| Phase 6 | Testing + polish + deployment | 2 days |
| **Total** | | **~12 days** |

---
