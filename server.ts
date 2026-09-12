import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const getTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

/**
 * Confirma que a requisição trouxe um ID token válido de um usuário
 * autenticado neste projeto Firebase, usando a API pública do Identity
 * Toolkit — sem isso, /api/send-email ficaria aberto para qualquer um na
 * internet disparar e-mail em nome do sistema.
 */
async function idTokenValido(idToken: string | undefined): Promise<boolean> {
  if (!idToken) return false;
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) return false;
  try {
    const resposta = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!resposta.ok) return false;
    const dados = await resposta.json();
    return Array.isArray(dados.users) && dados.users.length > 0;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Usado para notificações de permuta/substituição/exceção de escala.
  app.post("/api/send-email", async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      if (!(await idTokenValido(idToken))) {
        return res.status(401).json({ error: "Não autenticado." });
      }

      const { to, subject, text, html } = req.body;

      if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ error: "Missing required fields (to, subject, text/html)" });
      }

      const transporter = getTransporter();

      if (transporter) {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to,
          subject,
          text,
          html,
        });
        console.log("Email sent:", info.messageId);
        return res.json({ success: true, messageId: info.messageId });
      } else {
        console.log("[MOCK EMAIL SENT]", { to, subject, body: text || html });
        return res.json({ success: true, mock: true, message: "Email simulated. Configure SMTP variables in .env to send real emails." });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
