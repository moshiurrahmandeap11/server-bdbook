import "dotenv/config";
import dns from "dns";

// Fix for Node.js dual-stack IPv6 timeout issues on Linux networks
const origLookup = dns.lookup;
(dns as any).lookup = function (hostname: string, options: any, callback: any) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  } else if (typeof options === "number") {
    options = { family: options };
  }
  options = { ...options, family: 4 };
  return (origLookup as any).call(
    this,
    hostname,
    options,
    (err: any, address: any, family: any) => {
      if (options && options.all && Array.isArray(address)) {
        const ipv4Only = address.filter((a: any) => a.family === 4);
        return callback(err, ipv4Only, family);
      }
      return callback(err, address, family);
    }
  );
};

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
