import express from "express";
import cors from "cors";
import "./db";
import { flightsRouter } from "./routes/flights";
import { checkinRouter } from "./routes/checkin";
import { boardingRouter } from "./routes/boarding";
import { manifestRouter } from "./routes/manifest";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/flights", flightsRouter);
app.use("/api/checkin", checkinRouter);
app.use("/api/boarding", boardingRouter);
app.use("/api/manifest", manifestRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`DCS backend listening on :${port}`);
});
