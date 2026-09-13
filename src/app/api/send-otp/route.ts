import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { email, code, fullName } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: '"Campus Movie Series" <campusmovieseriescms@gmail.com>',
      to: email,
      subject: "Your CMS Verification Code",
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
          <div style="text-align: center; padding: 30px; background-color: #000;">
            <img src="cid:cmslogo" alt="CMS Logo" style="max-height: 50px; width: auto;" />
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; color: #eee; margin-top: 0;">Hi ${fullName || 'there'},</p>
            <p style="font-size: 15px; color: #ccc; line-height: 1.6;">
              Thank you for registering with Campus Movie Series! Please use the following 4-digit verification code to complete your registration.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <div style="background-color: #222; border: 1px solid #FFB400; border-radius: 8px; padding: 20px; display: inline-block;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #FFB400;">${code}</span>
              </div>
            </div>
            
            <p style="font-size: 14px; color: #999; text-align: center;">
              This code will expire in 10 minutes. If you did not request this, please ignore this email.
            </p>
          </div>
          
          <div style="background-color: #000; padding: 20px; text-align: center; border-top: 1px solid #333;">
            <p style="font-size: 12px; color: #666; margin: 0;">
              &copy; ${new Date().getFullYear()} Campus Movie Series. All rights reserved.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: 'logo.jpg',
          path: process.cwd() + '/public/logo.jpg',
          cid: 'cmslogo'
        }
      ]
    };

    // Fire and forget so we don't block the frontend
    transporter.sendMail(mailOptions).catch((err: any) => {
      console.error("Failed to send email silently:", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
