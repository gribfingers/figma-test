import express from "express";
import cors from "cors";
import "./db";
import { ensureSuperadmin } from "./bootstrapAdmin";
import { startDailyScheduler } from "./dailyScheduler";
import { backfillMissingBcbp, backfillOpenStatus } from "./scheduleGenerator";
import { flightsRouter } from "./routes/flights";
import { checkinRouter } from "./routes/checkin";
import { boardingRouter } from "./routes/boarding";
import { manifestRouter } from "./routes/manifest";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { messagesRouter } from "./routes/messages";
import { requireAuth } from "./middleware/auth";

ensureSuperadmin();
const backfilled = backfillMissingBcbp();
if (backfilled.updated > 0) console.log(`Backfilled bcbp/checkin_sequence for ${backfilled.updated} checked-in passenger(s).`);
const openStatusBackfilled = backfillOpenStatus();
if (openStatusBackfilled.updated > 0) console.log(`Opened ${openStatusBackfilled.updated} generated flight(s) for check-in/boarding.`);
startDailyScheduler();

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" })); // avatar/screenshot uploads ride along as a base64 data URL in the JSON body

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", messagesRouter);
// Every operational route requires a logged-in session — this app has no anonymous/read-only browsing.
app.use("/api/flights", requireAuth, flightsRouter);
app.use("/api/checkin", requireAuth, checkinRouter);
app.use("/api/boarding", requireAuth, boardingRouter);
app.use("/api/manifest", requireAuth, manifestRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`DCS backend listening on :${port}`);
});
