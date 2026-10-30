import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB() {
  if (env.DNS_SERVERS.length) dns.setServers(env.DNS_SERVERS);
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export const isDBConnected = () => mongoose.connection.readyState === 1;
