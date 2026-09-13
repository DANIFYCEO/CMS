import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { identifier } = await req.json();

    if (!identifier) {
      return NextResponse.json({ error: "Identifier is required" }, { status: 400 });
    }

    let email = identifier.trim();
    if (!identifier.includes("@")) {
      // Lookup email by username
      const usersRef = adminDb.collection("users");
      const snapshot = await usersRef.where("username", "==", identifier.toLowerCase()).get();
      if (snapshot.empty) {
        return NextResponse.json({ error: "user-not-found" }, { status: 400 });
      }
      email = snapshot.docs[0].data().email;
    }

    // Generate password reset link
    const resetLink = await adminAuth.generatePasswordResetLink(email);
    
    const url = new URL(resetLink);
    const oobCode = url.searchParams.get("oobCode");
    
    if (!oobCode) throw new Error("Could not extract reset token");

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const customResetLink = `${protocol}://${host}/reset-password?oobCode=${oobCode}`;

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
      subject: "Reset Your CMS Password",
      html: `
        <div style="font-family: 'Poppins', sans-serif, -apple-system; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
          <div style="text-align: center; padding: 25px 20px; background-color: #000; border-bottom: 1px solid #222;">
            <img src="https://raw.githubusercontent.com/DANIFYCEO/CMS/main/public/logo_original.jpg" alt="CMS Logo" style="max-height: 48px; width: auto; mix-blend-mode: screen;" />
          </div>
          
          <div style="padding: 35px 25px;">
            <p style="font-size: 16px; color: #eee; margin-top: 0;">Hello,</p>
            <p style="font-size: 14px; color: #ccc; line-height: 1.6;">
              We received a request to reset the password for your Campus Movie Series account. Click the button below to set a new password:
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${customResetLink}" style="background-color: #FFB400; color: #000; padding: 16px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(255,180,0,0.3);">Reset Password</a>
            </div>
            
            <p style="font-size: 13px; color: #888; text-align: center;">
              If you did not request a password reset, you can safely ignore this email.
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

    // Await sendMail so execution finishes properly on serverless
    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent:", info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Failed to generate or send reset link:", error);
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: "user-not-found" }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || "Failed to process request" }, { status: 500 });
  }
}
