import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, newId, name } = await req.json();

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.warn("[EMAIL MOCK] Email credentials not set in .env.local. Mocking send:");
      console.warn(`To: ${email}`);
      console.warn(`Subject: Your New Secure CMS ID`);
      console.warn(`Body: Hello ${name}, your new CMS ID is ${newId}`);
      return NextResponse.json({ success: true, message: "Email mocked (no credentials)" });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: `"CMS Membership" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Secure CMS Membership ID',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #FFD700;">Welcome to CMS!</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your membership has been successfully verified.</p>
          <p>For security purposes, we have generated a highly secure, randomized CMS Registration ID for your account.</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; text-transform: uppercase; color: #666;">Your Secure CMS ID</p>
            <h1 style="margin: 5px 0 0; color: #111; letter-spacing: 2px;">${newId}</h1>
          </div>
          <p>Please keep this ID safe. You will need it to access exclusive CMS offline events and member benefits.</p>
          <br/>
          <p>Best regards,<br/><strong>The CMS Team</strong></p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Successfully sent ID email to ${email}`);

    return NextResponse.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Failed to send email:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
