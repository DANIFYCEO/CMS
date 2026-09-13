import type { NextConfig } from "next";
import os from "os";

// Automatically discover all local IPv4 addresses so mobile devices on Wi-Fi are never blocked
const localIps: string[] = [];
const interfaces = os.networkInterfaces();
for (const devName in interfaces) {
  const iface = interfaces[devName];
  if (iface) {
    for (const alias of iface) {
      if (alias.family === "IPv4" && !alias.internal) {
        localIps.push(alias.address);
      }
    }
  }
}

const nextConfig: NextConfig = {
  // Allow dynamically discovered local network IPs + known hostnames
  allowedDevOrigins: [
    ...localIps,
    "10.102.116.246",
    "10.186.246.246",
    "10.163.158.246",
    "localhost",
    "127.0.0.1",
    "*.ngrok-free.dev",
    "*.loca.lt",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
