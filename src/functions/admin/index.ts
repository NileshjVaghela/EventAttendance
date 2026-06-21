import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, response } from "../shared/utils";
import { v4 as uuid } from "uuid";
import * as QRCode from "qrcode";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const ASSETS_BUCKET = process.env.ASSETS_BUCKET!;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;
  const pathParams = event.pathParameters || {};
  const queryParams = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  // Extract user role and email from Cognito claims
  const claims = event.requestContext.authorizer?.claims || {};
  const userRole = claims["custom:role"] || "admin";
  const userEmail = claims["email"] || "";

  try {
    // Events CRUD
    if (resource === "/admin/events" && method === "POST") {
      assertRole(userRole, "admin");
      return await createEvent(body);
    }
    if (resource === "/admin/events" && method === "GET") {
      return await listEvents(userRole, userEmail);
    }
    if (resource === "/admin/events/{eventId}" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await getEvent(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}" && method === "PUT") {
      assertRole(userRole, "admin");
      return await updateEvent(pathParams.eventId!, body);
    }
    if (resource === "/admin/events/{eventId}" && method === "DELETE") {
      assertRole(userRole, "admin");
      return await deleteEvent(pathParams.eventId!);
    }

    // Attendees
    if (resource === "/admin/events/{eventId}/attendees" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await listAttendees(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/attendees/upload" && method === "POST") {
      assertRole(userRole, "admin");
      return await uploadAttendees(pathParams.eventId!, body);
    }
    if (resource === "/admin/events/{eventId}/attendees/search" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await searchAttendees(pathParams.eventId!, queryParams);
    }

    // Sessions
    if (resource === "/admin/events/{eventId}/sessions" && method === "POST") {
      assertRole(userRole, "admin");
      return await createSession(pathParams.eventId!, body);
    }
    if (resource === "/admin/events/{eventId}/sessions" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await listSessions(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/sessions/{sessionId}" && method === "PUT") {
      assertRole(userRole, "admin");
      return await updateSession(pathParams.eventId!, pathParams.sessionId!, body);
    }
    if (resource === "/admin/events/{eventId}/sessions/{sessionId}" && method === "DELETE") {
      assertRole(userRole, "admin");
      return await deleteSession(pathParams.eventId!, pathParams.sessionId!);
    }

    // QR codes
    if (resource === "/admin/events/{eventId}/qr" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await generateEventQr(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/sessions/{sessionId}/qr" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await generateSessionQr(pathParams.eventId!, pathParams.sessionId!);
    }

    // Reports
    if (resource === "/admin/events/{eventId}/reports/checkin" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await checkinReport(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/reports/sessions" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await sessionReport(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/reports/rewards" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await rewardsReport(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/reports/export" && method === "GET") {
      await assertEventAccess(userRole, userEmail, pathParams.eventId!);
      return await exportReport(pathParams.eventId!, queryParams);
    }

    // Staff assignment (admin only)
    if (resource === "/admin/staff/assign" && method === "POST") {
      assertRole(userRole, "admin");
      return await assignStaff(body);
    }
    if (resource === "/admin/staff/unassign" && method === "POST") {
      assertRole(userRole, "admin");
      return await unassignStaff(body);
    }
    if (resource === "/admin/staff/assignments" && method === "GET") {
      assertRole(userRole, "admin");
      return await listStaffAssignments(queryParams);
    }

    // User management (admin only) — single POST endpoint with action field
    if (resource === "/admin/staff/users" && method === "POST") {
      assertRole(userRole, "admin");
      const action = body.action;
      if (action === "create") return await createUser(body);
      if (action === "list") return await listUsers();
      if (action === "delete") return await deleteUser(body.email);
      return response(400, { message: "action must be create, list, or delete" });
    }

    return response(404, { message: "Not found" });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return response(403, { message: "Insufficient permissions" });
    }
    console.error(err);
    return response(500, { message: "Internal server error" });
  }
}

function assertRole(current: string, required: string) {
  if (required === "admin" && current !== "admin") {
    throw new Error("FORBIDDEN");
  }
}

async function assertEventAccess(role: string, email: string, eventId: string) {
  if (role === "admin") return; // admins have full access
  // Desk staff: check assignment
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `STAFF#${email}`, SK: `EVENT#${eventId}` } })
  );
  if (!result.Item) throw new Error("FORBIDDEN");
}

async function getAssignedEventIds(email: string): Promise<string[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `STAFF#${email}`, ":prefix": "EVENT#" },
    })
  );
  return (result.Items || []).map((item: any) => item.eventId);
}

// --- Staff Assignment ---

async function assignStaff(body: { email: string; eventId: string }) {
  const { email, eventId } = body;
  if (!email || !eventId) return response(400, { message: "email and eventId required" });

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `STAFF#${email}`, SK: `EVENT#${eventId}`, email, eventId, assignedAt: Date.now() },
    })
  );
  return response(200, { message: `${email} assigned to event ${eventId}` });
}

async function unassignStaff(body: { email: string; eventId: string }) {
  const { email, eventId } = body;
  if (!email || !eventId) return response(400, { message: "email and eventId required" });

  await ddb.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `STAFF#${email}`, SK: `EVENT#${eventId}` } })
  );
  return response(200, { message: `${email} unassigned from event ${eventId}` });
}

async function listStaffAssignments(query: any) {
  const email = query.email;
  const eventId = query.eventId;

  if (email) {
    // List events assigned to a staff member
    const ids = await getAssignedEventIds(email);
    return response(200, { email, eventIds: ids });
  }
  if (eventId) {
    // List staff assigned to an event (scan STAFF# entries for this event)
    const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :prefix) AND SK = :sk",
        ExpressionAttributeValues: { ":prefix": "STAFF#", ":sk": `EVENT#${eventId}` },
      })
    );
    return response(200, { eventId, staff: (result.Items || []).map((i: any) => i.email) });
  }
  return response(400, { message: "email or eventId query parameter required" });
}

// --- User Management ---

const USER_POOL_ID = process.env.USER_POOL_ID!;

async function createUser(body: { email: string; role: string; tempPassword?: string }) {
  const { email, role } = body;
  if (!email || !role) return response(400, { message: "email and role required" });
  if (!["admin", "deskstaff"].includes(role)) return response(400, { message: "role must be admin or deskstaff" });

  const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminUpdateUserAttributesCommand } = await import("@aws-sdk/client-cognito-identity-provider");
  const cognito = new CognitoIdentityProviderClient({});

  const tempPassword = body.tempPassword || `Temp${Math.floor(1000 + Math.random() * 9000)}!`;

  await cognito.send(new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "email_verified", Value: "true" },
      { Name: "custom:role", Value: role },
    ],
    TemporaryPassword: tempPassword,
    MessageAction: "SUPPRESS",
  }));

  return response(201, { email, role, tempPassword, message: "User created. Share temp password with user." });
}

async function listUsers() {
  const { CognitoIdentityProviderClient, ListUsersCommand } = await import("@aws-sdk/client-cognito-identity-provider");
  const cognito = new CognitoIdentityProviderClient({});

  const result = await cognito.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID }));
  const users = (result.Users || []).map((u) => {
    const attrs = Object.fromEntries((u.Attributes || []).map((a) => [a.Name, a.Value]));
    return {
      email: attrs.email,
      role: attrs["custom:role"] || "admin",
      status: u.UserStatus,
      enabled: u.Enabled,
      createdAt: u.UserCreateDate?.toISOString(),
    };
  });
  return response(200, { users });
}

async function deleteUser(email: string) {
  const { CognitoIdentityProviderClient, AdminDeleteUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
  const cognito = new CognitoIdentityProviderClient({});

  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: email }));

  // Also clean up any event assignments
  const assignedIds = await getAssignedEventIds(email);
  for (const eventId of assignedIds) {
    await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `STAFF#${email}`, SK: `EVENT#${eventId}` } }));
  }

  return response(200, { message: `User ${email} deleted` });
}

// --- Events ---

async function createEvent(body: any) {
  const eventId = uuid();
  const item: any = {
    PK: `EVENT#${eventId}`,
    SK: "#METADATA",
    eventId,
    name: body.name,
    description: body.description || "",
    date: body.date,
    startTime: new Date(body.startTime).getTime(),
    endTime: new Date(body.endTime).getTime(),
    location: body.location || "",
    timezone: body.timezone || "Asia/Kolkata",
    status: "draft",
    rewardThreshold: body.rewardThreshold || 0,
    createdAt: Date.now(),
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return response(201, item);
}

async function listEvents(role: string, email: string) {
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const scanResult = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "SK = :meta AND begins_with(PK, :prefix)",
      ExpressionAttributeValues: { ":meta": "#METADATA", ":prefix": "EVENT#" },
    })
  );
  let events = scanResult.Items || [];

  // Desk staff: filter to assigned events only
  if (role === "deskstaff") {
    const assignedIds = await getAssignedEventIds(email);
    events = events.filter((e: any) => assignedIds.includes(e.eventId));
  }

  return response(200, { events });
}

async function getEvent(eventId: string) {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" } })
  );
  if (!result.Item) return response(404, { message: "Event not found" });
  return response(200, result.Item);
}

async function updateEvent(eventId: string, body: any) {
  const expressions: string[] = [];
  const values: any = {};
  const names: any = {};
  if (body.name) { expressions.push("#n = :name"); values[":name"] = body.name; names["#n"] = "name"; }
  if (body.description !== undefined) { expressions.push("description = :desc"); values[":desc"] = body.description; }
  if (body.date) { expressions.push("#d = :date"); values[":date"] = body.date; names["#d"] = "date"; }
  if (body.startTime) { expressions.push("startTime = :st"); values[":st"] = new Date(body.startTime).getTime(); }
  if (body.endTime) { expressions.push("endTime = :et"); values[":et"] = new Date(body.endTime).getTime(); }
  if (body.location) { expressions.push("#loc = :loc"); values[":loc"] = body.location; names["#loc"] = "location"; }
  if (body.timezone) { expressions.push("timezone = :tz"); values[":tz"] = body.timezone; }
  if (body.status) { expressions.push("#s = :status"); values[":status"] = body.status; names["#s"] = "status"; }
  if (body.rewardThreshold !== undefined) { expressions.push("rewardThreshold = :rt"); values[":rt"] = body.rewardThreshold; }

  if (expressions.length === 0) return response(400, { message: "No fields to update" });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names }),
    })
  );
  return response(200, { message: "Updated" });
}

async function deleteEvent(eventId: string) {
  await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" } }));
  return response(200, { message: "Deleted" });
}

// --- Attendees ---

async function listAttendees(eventId: string) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `EVENT#${eventId}`, ":prefix": "ATTENDEE#" },
    })
  );
  return response(200, { attendees: result.Items || [] });
}

async function uploadAttendees(eventId: string, body: { attendees: any[] }) {
  const attendees = body.attendees;
  if (!attendees || !Array.isArray(attendees)) {
    return response(400, { message: "attendees array required" });
  }

  let count = 0;
  for (const att of attendees) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `EVENT#${eventId}`,
          SK: `ATTENDEE#${att.sequenceNumber}`,
          sequenceNumber: att.sequenceNumber,
          name: att.name,
          email: att.email,
          designation: att.designation || "",
          company: att.company || "",
          checkedIn: false,
        },
      })
    );
    count++;
  }
  return response(200, { message: `${count} attendees uploaded` });
}

async function searchAttendees(eventId: string, query: any) {
  const searchTerm = (query.q || "").toLowerCase();
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `EVENT#${eventId}`, ":prefix": "ATTENDEE#" },
    })
  );

  const filtered = (result.Items || []).filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm) ||
    item.sequenceNumber?.includes(searchTerm) ||
    item.company?.toLowerCase().includes(searchTerm)
  );
  return response(200, { attendees: filtered });
}

// --- Sessions ---

async function createSession(eventId: string, body: any) {
  // Validate session is within event time window
  const eventData = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" } }));
  if (eventData.Item?.startTime && eventData.Item?.endTime) {
    const sessStart = new Date(body.startTime).getTime();
    const sessEnd = new Date(body.endTime).getTime();
    if (sessStart < eventData.Item.startTime || sessEnd > eventData.Item.endTime) {
      return response(400, { message: "Session must be within event start/end time" });
    }
  }

  const sessionId = uuid();
  const item = {
    PK: `EVENT#${eventId}`,
    SK: `SESSION#${sessionId}`,
    sessionId,
    eventId,
    name: body.name,
    date: body.date,
    startTime: new Date(body.startTime).getTime(),
    endTime: new Date(body.endTime).getTime(),
    createdAt: Date.now(),
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return response(201, item);
}

async function listSessions(eventId: string) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `EVENT#${eventId}`, ":prefix": "SESSION#" },
    })
  );
  return response(200, { sessions: result.Items || [] });
}

async function updateSession(eventId: string, sessionId: string, body: any) {
  // Validate session is within event time window
  if (body.startTime || body.endTime) {
    const eventData = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" } }));
    if (eventData.Item?.startTime && eventData.Item?.endTime) {
      const sessStart = body.startTime ? new Date(body.startTime).getTime() : 0;
      const sessEnd = body.endTime ? new Date(body.endTime).getTime() : Infinity;
      if (sessStart < eventData.Item.startTime || sessEnd > eventData.Item.endTime) {
        return response(400, { message: "Session must be within event start/end time" });
      }
    }
  }

  const expressions: string[] = [];
  const values: any = {};
  const names: any = {};
  if (body.name) { expressions.push("#n = :name"); values[":name"] = body.name; names["#n"] = "name"; }
  if (body.startTime) { expressions.push("startTime = :st"); values[":st"] = new Date(body.startTime).getTime(); }
  if (body.endTime) { expressions.push("endTime = :et"); values[":et"] = new Date(body.endTime).getTime(); }

  if (expressions.length === 0) return response(400, { message: "No fields to update" });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `EVENT#${eventId}`, SK: `SESSION#${sessionId}` },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names }),
    })
  );
  return response(200, { message: "Updated" });
}

async function deleteSession(eventId: string, sessionId: string) {
  await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: `SESSION#${sessionId}` } }));
  return response(200, { message: "Deleted" });
}

// --- QR Codes ---

async function generateEventQr(eventId: string) {
  const baseUrl = process.env.FRONTEND_URL || "https://your-domain.com";
  const url = `${baseUrl}/checkin?event=${eventId}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return response(200, { qrCode: qrDataUrl, url });
}

async function generateSessionQr(eventId: string, sessionId: string) {
  const baseUrl = process.env.FRONTEND_URL || "https://your-domain.com";
  const url = `${baseUrl}/session?event=${eventId}&session=${sessionId}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return response(200, { qrCode: qrDataUrl, url });
}

// --- Reports ---

async function checkinReport(eventId: string) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `EVENT#${eventId}`, ":prefix": "ATTENDEE#" },
    })
  );
  const attendees = result.Items || [];
  const checkedIn = attendees.filter((a: any) => a.checkedIn);
  return response(200, {
    total: attendees.length,
    checkedIn: checkedIn.length,
    pending: attendees.length - checkedIn.length,
    attendees,
  });
}

async function sessionReport(eventId: string) {
  // Get all sessions
  const sessions = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `EVENT#${eventId}`, ":prefix": "SESSION#" },
    })
  );

  const report = [];
  for (const session of sessions.Items || []) {
    const attendance = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": `EVENT#${eventId}#SESSION#${session.sessionId}` },
      })
    );
    report.push({
      sessionId: session.sessionId,
      name: session.name,
      attendanceCount: (attendance.Items || []).length,
    });
  }
  return response(200, { sessions: report });
}

async function rewardsReport(eventId: string) {
  // Get event threshold
  const eventData = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" } })
  );
  const threshold = eventData.Item?.rewardThreshold || 0;

  // Get all attendees
  const attendees = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `EVENT#${eventId}`, ":prefix": "ATTENDEE#" },
    })
  );

  // For each attendee, count sessions attended
  const results = [];
  for (const att of attendees.Items || []) {
    const attendance = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `EVENT#${eventId}#ATT#${att.sequenceNumber}`,
          ":prefix": "SESSION#",
        },
      })
    );
    const sessionsAttended = (attendance.Items || []).length;
    results.push({
      sequenceNumber: att.sequenceNumber,
      name: att.name,
      company: att.company,
      sessionsAttended,
      eligible: sessionsAttended >= threshold,
    });
  }

  return response(200, {
    threshold,
    eligible: results.filter((r) => r.eligible),
    all: results,
  });
}

async function exportReport(eventId: string, query: any) {
  const type = query.type || "checkin";
  let data: any;

  if (type === "checkin") {
    const r = await checkinReport(eventId);
    data = JSON.parse(r.body);
  } else if (type === "rewards") {
    const r = await rewardsReport(eventId);
    data = JSON.parse(r.body);
  }

  // Convert to CSV
  const items = data?.attendees || data?.all || [];
  if (items.length === 0) return response(200, { csv: "" });

  const headers = Object.keys(items[0]).join(",");
  const rows = items.map((item: any) => Object.values(item).join(","));
  const csv = [headers, ...rows].join("\n");

  return response(200, { csv, filename: `${type}-report-${eventId}.csv` });
}
