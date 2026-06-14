import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME, response, generateOtp, hashOtp } from "../shared/utils";
import { sendOtpEmail } from "../shared/email";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.resource;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    if (path === "/checkin/verify-sequence") {
      return await verifySequence(body);
    } else if (path === "/checkin/verify-otp") {
      return await verifyOtp(body);
    }
    return response(404, { message: "Not found" });
  } catch (err: any) {
    console.error(err);
    return response(500, { message: "Internal server error" });
  }
}

async function verifySequence(body: { eventId: string; sequenceNumber: string }) {
  const { eventId, sequenceNumber } = body;
  if (!eventId || !sequenceNumber) {
    return response(400, { message: "eventId and sequenceNumber required" });
  }

  // Get attendee
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
    return response(403, { message: "Event is not active. Check-in is not available yet." });
  }

  // Check OTP generation limit (max 5 total for this attendee per event)
  const otpKey = { PK: `OTP#${eventId}#${sequenceNumber}`, SK: "#LATEST" };
  const existingOtp = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: otpKey }));

  if (existingOtp.Item && existingOtp.Item.totalAttempts >= 5) {
    return response(429, { message: "OTP limit reached (5). Please contact desk staff." });
  }

  // Rate limit (max 3 per 10 min window)
  if (existingOtp.Item && existingOtp.Item.attempts >= 3) {
    const elapsed = Date.now() - existingOtp.Item.createdAt;
    if (elapsed < 600000) {
      return response(429, { message: "Too many OTP requests. Try again later." });
    }
  }

  // Get event name
  const eventData = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `EVENT#${eventId}`, SK: "#METADATA" } })
  );
  const eventName = eventData.Item?.name || "Event";

  // Generate and store OTP
  const otp = generateOtp();
  const now = Date.now();
  const prevTotal = existingOtp.Item?.totalAttempts || 0;
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...otpKey,
        otpHash: hashOtp(otp),
        createdAt: now,
        expiresAt: Math.floor((now + 600000) / 1000), // TTL: 10 min
        attempts: (existingOtp.Item?.attempts || 0) + 1,
        totalAttempts: prevTotal + 1,
        verifyAttempts: 0,
      },
    })
  );

  // Send OTP email
  await sendOtpEmail(attendee.Item.email, otp, eventName);

  return response(200, { message: "OTP sent to registered email", email: maskEmail(attendee.Item.email) });
}

async function verifyOtp(body: { eventId: string; sequenceNumber: string; otp: string }) {
  const { eventId, sequenceNumber, otp } = body;
  if (!eventId || !sequenceNumber || !otp) {
    return response(400, { message: "eventId, sequenceNumber, and otp required" });
  }

  const otpKey = { PK: `OTP#${eventId}#${sequenceNumber}`, SK: "#LATEST" };
  const stored = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: otpKey }));

  if (!stored.Item) {
    return response(400, { message: "No OTP found. Please request a new one." });
  }

  // Check expiry
  if (Date.now() > stored.Item.expiresAt * 1000) {
    return response(400, { message: "OTP expired. Please request a new one." });
  }

  // Check max verify attempts
  if (stored.Item.verifyAttempts >= 3) {
    return response(429, { message: "Too many attempts. Please request a new OTP." });
  }

  // Increment verify attempts
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: otpKey,
      UpdateExpression: "SET verifyAttempts = verifyAttempts + :one",
      ExpressionAttributeValues: { ":one": 1 },
    })
  );

  // Verify OTP
  if (hashOtp(otp) !== stored.Item.otpHash) {
    return response(401, { message: "Invalid OTP" });
  }

  // Get attendee info
  const attendee = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `EVENT#${eventId}`, SK: `ATTENDEE#${sequenceNumber}` },
    })
  );

  if (!attendee.Item) {
    return response(404, { message: "Attendee not found" });
  }

  // Mark as checked in
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `EVENT#${eventId}`, SK: `ATTENDEE#${sequenceNumber}` },
      UpdateExpression: "SET checkedIn = :true, checkedInAt = :now",
      ExpressionAttributeValues: { ":true": true, ":now": Date.now() },
    })
  );

  return response(200, {
    verified: true,
    attendee: {
      name: attendee.Item.name,
      designation: attendee.Item.designation,
      company: attendee.Item.company,
      sequenceNumber: attendee.Item.sequenceNumber,
    },
  });
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  const masked = user.slice(0, 2) + "***";
  return `${masked}@${domain}`;
}
