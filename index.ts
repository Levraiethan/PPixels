import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import Redis from "ioredis";
import Stripe from "stripe";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { COOLDOWN_MS, GRID_W, GRID_H } from "../../packages/shared/index";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.ALLOWED_WEB_ORIGINS || "").split(","),
    credentials: true,
  },
});

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" }) : null;

app.use(cors({ origin: (process.env.ALLOWED_WEB_ORIGINS || "").split(","), credentials: true }));
app.use(express.json());

// Simple in-memory grid (last known color). For prod, chunk + Redis bitmap or key-per-chunk.
const grid = new Map<string, string>(); // key = "x:y" -> color hex

function keyXY(x:number,y:number){ return x+":"+y; }

function verifyJWT(token: string | undefined) {
  if (!token) return null;
  try {
    const payload = jwt.decode(token) as any; // dev mode: accept unsigned (NextAuth default JWT not RS256)
    if (!payload?.sub) return null;
    return { userId: payload.sub as string, email: payload.email as string | undefined };
  } catch (e) { return null; }
}

io.on("connection", (socket) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const user = verifyJWT(token);
  if (!user) {
    socket.disconnect(true);
    return;
  }

  socket.on("place_pixel", async (data) => {
    const schema = z.object({
      x: z.number().int().min(0).max(GRID_W-1),
      y: z.number().int().min(0).max(GRID_H-1),
      color: z.string().regex(/^#?[0-9A-Fa-f]{6}$/)
    });
    const parsed = schema.safeParse(data);
    if (!parsed.success) return;

    const { x, y, color } = parsed.data;
    const now = Date.now();

    // Ban check
    const ban = await prisma.ban.findUnique({ where: { userId: user.userId } });
    if (ban && (!ban.until || ban.until.getTime() > now)) return;

    // Cooldown
    const cdKey = `cd:user:${user.userId}`;
    const next = Number(await redis.get(cdKey) ?? 0);
    if (now < next) {
      socket.emit("cooldown", { msRemaining: next - now });
      return;
    }

    // Credits
    const me = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!me) return;
    if (me.credits <= 0) {
      socket.emit("cooldown", { msRemaining: 1000 }); // tiny nudge + no credit
      return;
    }

    // Spend 1 credit
    await prisma.user.update({ where: { id: user.userId }, data: { credits: { decrement: 1 } } });

    // Persist placement
    await prisma.placement.create({ data: { userId: user.userId, x, y, color: color.startsWith("#")?color:("#"+color) } });

    // Update grid cache
    grid.set(keyXY(x,y), color.startsWith("#")?color:("#"+color));

    io.emit("pixel_placed", { x, y, color, userId: user.userId, t: now });

    // Set cooldown
    await redis.set(cdKey, String(now + COOLDOWN_MS), "PX", Math.ceil(COOLDOWN_MS/1000));
    socket.emit("cooldown", { msRemaining: COOLDOWN_MS });
  });
});

// DEV: add credits without Stripe
app.post("/dev/add-credits", async (req, res) => {
  const { userId, amount } = req.body ?? {};
  if (!userId || typeof amount !== "number") return res.status(400).json({ error: "bad_body" });
  await prisma.user.update({ where: { id: userId }, data: { credits: { increment: Math.max(0, amount) } } });
  res.json({ ok: true });
});

// Stripe webhook (optional)
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(200).send("stripe_disabled");
  const sig = req.headers["stripe-signature"] as string;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err:any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const session: any = event.data.object;
    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits || 0);
    if (userId && credits>0) {
      await prisma.user.update({ where: { id: userId }, data: { credits: { increment: credits } } });
    }
  }
  res.json({ received: true });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => console.log("API/WS on :" + PORT));
