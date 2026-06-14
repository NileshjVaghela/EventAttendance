import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({});
const FROM_EMAIL = process.env.SES_FROM_EMAIL!;

export async function sendOtpEmail(toEmail: string, otp: string, eventName: string): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: `Your Check-in OTP for ${eventName}` },
        Body: {
          Html: {
            Data: `
              <h2>Event Check-in Verification</h2>
              <p>Your OTP for <strong>${eventName}</strong> is:</p>
              <h1 style="font-size:36px;letter-spacing:8px;color:#2563eb">${otp}</h1>
              <p>This code expires in 10 minutes.</p>
            `,
          },
        },
      },
    })
  );
}
