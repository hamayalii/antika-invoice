// Idempotent: creates the admin user (ADMIN_USERNAME/ADMIN_PASSWORD) and ID counters if missing. Run as a Railway pre-deploy step.
const {PrismaClient}=require("@prisma/client");const b=require("bcryptjs");const p=new PrismaClient();
(async()=>{const u=process.env.ADMIN_USERNAME||"admin";
if(!(await p.user.findUnique({where:{username:u}}))){await p.user.create({data:{username:u,fullName:process.env.ADMIN_FULL_NAME||"Antika Administrator",role:"admin",passwordHash:await b.hash(process.env.ADMIN_PASSWORD,12),mustChangePassword:true}});console.log("admin created")}else console.log("admin exists");
await p.$executeRaw`INSERT INTO counters (name, value) VALUES (${"invoice"}, ${1000}) ON CONFLICT (name) DO NOTHING`;
await p.$executeRaw`INSERT INTO counters (name, value) VALUES (${"voucher"}, ${0}) ON CONFLICT (name) DO NOTHING`;
await p.$disconnect()})().catch(e=>{console.error(e);process.exit(1)});
