import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not regular password)
  },
});

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Inter',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                    <span style="color:white;font-size:18px;">◈</span>
                  </div>
                  <div style="font-size:22px;font-weight:700;color:white;letter-spacing:-0.3px;">Sentinel</div>
                  <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">Observability Platform</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="font-size:15px;color:#0f172a;font-weight:600;margin:0 0 8px;">Your sign-in code</p>
            <p style="font-size:14px;color:#64748b;margin:0 0 32px;line-height:1.6;">
              Use the code below to sign in to your Sentinel dashboard. This code expires in <strong>10 minutes</strong>.
            </p>
            <!-- OTP Box -->
            <div style="background:#f0f7ff;border:2px dashed #3b82f6;border-radius:16px;padding:28px;text-align:center;margin-bottom:32px;">
              <div style="font-family:'Courier New',monospace;font-size:40px;font-weight:700;letter-spacing:12px;color:#1d4ed8;line-height:1;">
                ${otp}
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:12px;">Enter this code in your browser</div>
            </div>
            <div style="background:#fef2f2;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
              <p style="font-size:13px;color:#dc2626;margin:0;">
                🔒 Never share this code with anyone. Sentinel will never ask for it.
              </p>
            </div>
            <p style="font-size:13px;color:#94a3b8;margin:0;line-height:1.6;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #f1f5f9;padding:20px 40px;">
            <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">
              Sent by Sentinel · Titan Protocol v2.0
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Sentinel" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `${otp} is your Sentinel sign-in code`,
    html,
  });
}
