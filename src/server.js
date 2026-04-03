import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import authRouter from "./routes/auth.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

app.use(
  cors({
    origin: env.appBaseUrl,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.use("/auth", authRouter);

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});
