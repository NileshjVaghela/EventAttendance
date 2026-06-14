import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, response } from "../shared/utils";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    return await recordAttendance(body);
  } catch (err: any) {
    console.error(err);
    return response(500, { message: "Internal server error" });
  }
}

async function recordAttendance(body: { eventId: string; sessionId: string; sequenceNumber: string }) {
  const { eventId, sessionId, sequenceNumber } = body;
  if (!eventId || !sessionId || !sequenceNumber) {
    return response(400, { message: "eventId, sessionId, and sequenceNumber required" });
  }

  // Validate attendee exists
  const attendee = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `EVENT#${eventId}`, SK: `ATTENDEE#${sequenceNumber}` },
    })
  );

  if (!attendee.Item) {
    return response(404, { message: "Sequence number not found" });
  }

  // Check event is active
  const eventCheck = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" } })
  );
  if (!eventCheck.Item || eventCheck.Item.status !== "active") {
    return response(403, { message: "Event is not active. Session attendance is not available." });
  }

  // Validate session exists and is active
  const session = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `EVENT#${eventId}`, SK: `SESSION#${sessionId}` },
    })
  );

  if (!session.Item) {
    return response(404, { message: "Session not found" });
  }

  const now = Date.now();
  if (now < session.Item.startTime || now > session.Item.endTime) {
    return response(403, { message: "Session not active" });
  }

  // Check duplicate
  const attendanceKey = {
    PK: `EVENT#${eventId}#ATT#${sequenceNumber}`,
    SK: `SESSION#${sessionId}`,
  };

  const existing = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: attendanceKey }));
  if (existing.Item) {
    return response(200, { message: "Already recorded", sessionName: session.Item.name });
  }

  // Record attendance
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...attendanceKey,
        GSI1PK: `EVENT#${eventId}#SESSION#${sessionId}`,
        GSI1SK: `ATTENDEE#${sequenceNumber}`,
        recordedAt: now,
        attendeeName: attendee.Item.name,
      },
    })
  );

  return response(200, { message: `Attendance recorded for ${session.Item.name}`, sessionName: session.Item.name });
}
