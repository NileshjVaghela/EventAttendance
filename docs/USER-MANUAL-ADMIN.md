# Admin User Manual — Event Attendance System

## Login

1. Go to: `https://<your-cloudfront-domain>/admin/login`
2. Enter your email and password
3. Solve the math captcha (e.g., "3 + 5 = ?")
4. Click **Sign In**

---

## Dashboard

After login, you land on the Dashboard showing all events. From here you can:
- View all events with their status (draft/active/completed)
- Click **Manage** to open an event's detail page

---

## Managing Events

### Create an Event

1. From Dashboard, click **+ Create Event**
2. Fill in:
   - **Name** — event title (e.g., "Tech Conference 2026")
   - **Date** — event date
   - **Location** — venue name/city
   - **Reward Threshold** — number of sessions an attendee must attend to be eligible for rewards
3. Click **Create Event**

### Activate an Event

- Events start as **draft** — check-in and session attendance are blocked
- Click **Activate** to make the event live
- Click **Complete** when the event is over

### Edit/Delete an Event

- Open the event and click Edit to change name, date, location, or threshold
- Delete removes the event entirely

---

## Managing Attendees

### Upload Attendees

Paste a JSON array in the upload form:

```json
[
  {"sequenceNumber": "0001", "name": "John Doe", "email": "john@example.com", "designation": "Developer", "company": "Acme"}
]
```

| Field | Required | Description |
|-------|----------|-------------|
| sequenceNumber | Yes | Unique 3-4 digit number |
| name | Yes | Full name |
| email | Yes | Email for OTP delivery |
| designation | No | Job title |
| company | No | Company name |

### Search Attendees

- Search by name, sequence number, or company
- View check-in status (auto-refreshes every 5 seconds)

---

## Managing Sessions

1. Open an event → Sessions tab
2. Click **+ Add Session**
3. Fill in name, date, start time, end time
4. Save

**Important:** Session attendance QR codes only work within the start/end time window.

---

## QR Codes

### Event Check-in QR
- Click **Check-in QR** button on event detail page
- Print and display at registration desk
- Attendees scan to begin check-in

### Session QR
- Click **QR** button next to any session
- Display on stage screen or standees in session room

---

## Reports

Click **Reports** button on event detail page. Three report types:

### Check-in Report
- Total/checked-in/pending counts
- Per-column filters (seq#, name, email, company, status)
- Date filter for check-in timestamp
- Pagination (10 per page)

### Session Attendance Report
- Per-session attendance count
- Searchable by session name

### Rewards Eligibility Report
- Shows sessions attended per attendee
- Eligible/not-eligible based on threshold
- Filterable by all columns

---

## User Management

Admin can create desk staff users with `custom:role = staff` in Cognito.
Staff have read-only access.

---

## Important Notes

- **SES Sandbox**: In sandbox mode, OTP emails only send to verified addresses
- **OTP Limits**: Max 5 total OTPs per attendee, max 3 per 10-minute window
- **Event must be Active**: Check-in and session attendance blocked unless event status is "active"
- **Auto-refresh**: Attendee list refreshes every 5 seconds
