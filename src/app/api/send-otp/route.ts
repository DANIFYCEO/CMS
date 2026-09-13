import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { email, code, fullName } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_APP_PASSWORD?.replace(/^["']|["']$/g, '').trim();

    if (!emailUser || !emailPass) {
      console.error("Missing EMAIL_USER or EMAIL_APP_PASSWORD in environment variables");
      return NextResponse.json({ error: "Email service not configured on server" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const mailOptions = {
      from: `"Campus Movie Series" <${emailUser}>`,
      to: email,
      subject: "Your CMS Verification Code",
      html: `
        <div style="font-family: 'Poppins', sans-serif, -apple-system; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
          <div style="text-align: center; padding: 25px 20px; background-color: #000; border-bottom: 1px solid #222;">
            <img src="https://raw.githubusercontent.com/DANIFYCEO/CMS/main/public/logo_original.jpg" alt="CMS Logo" style="max-height: 48px; width: auto; mix-blend-mode: screen;" />
          </div>
          
          <div style="padding: 35px 25px;">
            <p style="font-size: 16px; color: #eee; margin-top: 0;">Hi ${fullName || 'Creative'},</p>
            <p style="font-size: 14px; color: #ccc; line-height: 1.6;">
              Welcome to Campus Movie Series! Use the following 4-digit verification code to complete your registration.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #18181b; border: 2px solid #FFB400; border-radius: 12px; padding: 18px 32px; display: inline-block;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #FFB400; font-family: monospace;">${code}</span>
              </div>
            </div>
            
            <p style="font-size: 13px; color: #888; text-align: center;">
              This code will expire in 10 minutes. If you did not request this, please disregard this email.
            </p>
          </div>
          
          <div style="background-color: #050505; padding: 18px; text-align: center; border-top: 1px solid #222;">
            <p style="font-size: 11px; color: #555; margin: 0;">
              &copy; ${new Date().getFullYear()} Campus Movie Series (CMS). All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    // Await sendMail on serverless so execution isn't killed prematurely
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP Email sent successfully:", info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Failed to send OTP email:", error);
    return NextResponse.json({ 
      error: error?.message || "Failed to send verification email" 
    }, { status: 500 });
  }
}
