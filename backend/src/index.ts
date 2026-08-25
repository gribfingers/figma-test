import express from "express";
import cors from "cors";
import "./db";
import { flightsRouter } from "./routes/flights";
import { checkinRouter } from "./routes/checkin";
import { boardingRouter } from "./routes/boarding";
import { manifestRouter } from "./routes/manifest";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { requireAuth } from "./middleware/auth";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // avatar uploads ride along as a base64 data URL in the JSON body

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
// Every operational route requires a logged-in session — this app has no anonymous/read-only browsing.
app.use("/api/flights", requireAuth, flightsRouter);
app.use("/api/checkin", requireAuth, checkinRouter);
app.use("/api/boarding", requireAuth, boardingRouter);
app.use("/api/manifest", requireAuth, manifestRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`DCS backend listening on :${port}`);
});
