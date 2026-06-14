# Desk Staff User Manual — Event Attendance System

## Overview

As desk staff, you have **read-only access**:
- View attendee lists and check-in status
- Search attendees by name, sequence number, or company
- View session attendance counts
- View reports

You **cannot** create, edit, or delete events, sessions, or attendees.

---

## Login

1. Go to: `https://<your-cloudfront-domain>/admin/login`
2. Enter email and password provided by your admin
3. Solve the math captcha
4. Click **Sign In**

---

## Daily Workflow

### During Registration

1. Attendee scans QR code at your desk
2. They enter sequence number and OTP on their phone
3. Their phone displays: **Name, Designation, Company**
4. You read the display and confirm identity
5. They are checked in — no action needed from you

### Searching Attendees

- Go to event → Attendees tab
- Use search bar (name, seq#, or company)
- Status updates automatically every 5 seconds

### Helping Attendees

| Issue | Solution |
|-------|----------|
| "I don't know my sequence number" | Search by name/company |
| "OTP not received" | Check spam, wait 30s, max 3 per 10 min |
| "Session QR says not active" | Check session schedule timing |
| "Already recorded" | Normal — attendance already logged |

---

## What You Can Access

✅ View events, attendees, sessions, reports, search

## What You Cannot Do

❌ Create/edit/delete events, sessions, attendees, QR codes, or users

---

## Important Notes

- Stay logged in during your shift (session expires after 8 hours)
- Don't share your login with attendees
- Attendee list auto-refreshes — no need to manually reload
