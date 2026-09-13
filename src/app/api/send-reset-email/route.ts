import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { identifier } = await req.json();

    if (!identifier) {
      return NextResponse.json({ error: "Identifier is required" }, { status: 400 });
    }

    let email = identifier;
    if (!identifier.includes("@")) {
      // Lookup email by username
      const usersRef = adminDb.collection("users");
      const snapshot = await usersRef.where("username", "==", identifier.toLowerCase()).get();
      if (snapshot.empty) {
        return NextResponse.json({ error: "user-not-found" }, { status: 400 });
      }
      email = snapshot.docs[0].data().email;
    }

    // Generate the password reset link using Firebase Admin SDK
    const resetLink = await adminAuth.generatePasswordResetLink(email);
    
    // Instead of using Firebase's default out-of-the-box page,
    // we want to extract the oobCode (token) and point it to our OWN beautiful Next.js page!
    const url = new URL(resetLink);
    const oobCode = url.searchParams.get("oobCode");
    
    if (!oobCode) throw new Error("Could not extract reset token");

    // Dynamically get the host so it works on mobile Wi-Fi testing too!
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const customResetLink = `${protocol}://${host}/reset-password?oobCode=${oobCode}`;

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
      subject: "Reset Your CMS Password",
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #333;">
          <div style="text-align: center; padding: 30px; background-color: #000;">
            <img src="cid:cmslogo" alt="CMS Logo" style="max-height: 50px; width: auto;" />
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; color: #eee; margin-top: 0;">Hello,</p>
            <p style="font-size: 15px; color: #ccc; line-height: 1.6;">
              We received a request to reset your password for your Campus Movie Series account.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${customResetLink}" style="background-color: #FFB400; color: #000; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Reset Password</a>
            </div>
            
            <p style="font-size: 14px; color: #999; text-align: center;">
              If you didn't ask to reset your password, you can safely ignore this email.
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

    // Fire and forget
    transporter.sendMail(mailOptions).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to generate reset link:", error);
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: "user-not-found" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
