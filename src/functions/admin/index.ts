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

  // Extract user role from Cognito claims
  const claims = event.requestContext.authorizer?.claims || {};
  const userRole = claims["custom:role"] || "admin";

  try {
    // Events CRUD
    if (resource === "/admin/events" && method === "POST") {
      assertRole(userRole, "admin");
      return await createEvent(body);
    }
    if (resource === "/admin/events" && method === "GET") {
      return await listEvents();
    }
    if (resource === "/admin/events/{eventId}" && method === "GET") {
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
      return await listAttendees(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/attendees/upload" && method === "POST") {
      assertRole(userRole, "admin");
      return await uploadAttendees(pathParams.eventId!, body);
    }
    if (resource === "/admin/events/{eventId}/attendees/search" && method === "GET") {
      return await searchAttendees(pathParams.eventId!, queryParams);
    }

    // Sessions
    if (resource === "/admin/events/{eventId}/sessions" && method === "POST") {
      assertRole(userRole, "admin");
      return await createSession(pathParams.eventId!, body);
    }
    if (resource === "/admin/events/{eventId}/sessions" && method === "GET") {
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
      return await generateEventQr(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/sessions/{sessionId}/qr" && method === "GET") {
      return await generateSessionQr(pathParams.eventId!, pathParams.sessionId!);
    }

    // Reports
    if (resource === "/admin/events/{eventId}/reports/checkin" && method === "GET") {
      return await checkinReport(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/reports/sessions" && method === "GET") {
      return await sessionReport(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/reports/rewards" && method === "GET") {
      return await rewardsReport(pathParams.eventId!);
    }
    if (resource === "/admin/events/{eventId}/reports/export" && method === "GET") {
      return await exportReport(pathParams.eventId!, queryParams);
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

async function listEvents() {
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const scanResult = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "SK = :meta AND begins_with(PK, :prefix)",
      ExpressionAttributeValues: { ":meta": "#METADATA", ":prefix": "EVENT#" },
    })
  );
  return response(200, { events: scanResult.Items || [] });
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
