import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

dotenv.config();

/**
 * Admin SDK só é inicializado se houver uma service account configurada
 * (FIREBASE_SERVICE_ACCOUNT_JSON, o conteúdo integral do JSON baixado em
 * Firebase Console → Configurações do projeto → Contas de serviço → Gerar
 * nova chave privada — nunca versionado, só via variável de ambiente).
 * Sem ela, /api/send-push responde 503 e o resto do app segue normal
 * (alerta interno + e-mail continuam funcionando sem push).
 */
let mensageiro: Messaging | null = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const credenciais = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const app = initializeApp({ credential: cert(credenciais) });
    mensageiro = getMessaging(app);
  } catch (erro) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON inválido — push desativado:", erro);
  }
}

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
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

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

  // Usado para notificações push (Firebase Cloud Messaging) — ver notificar() em AppContext.tsx.
  app.post("/api/send-push", async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      if (!(await idTokenValido(idToken))) {
        return res.status(401).json({ error: "Não autenticado." });
      }

      if (!mensageiro) {
        return res.status(503).json({ error: "Push não configurado neste servidor (FIREBASE_SERVICE_ACCOUNT_JSON ausente)." });
      }

      const { tokens, title, body, link } = req.body;
      if (!Array.isArray(tokens) || tokens.length === 0 || !title || !body) {
        return res.status(400).json({ error: "Missing required fields (tokens, title, body)" });
      }

      const resultado = await mensageiro.sendEachForMulticast({
        tokens,
        data: { title: String(title), body: String(body), link: link ? String(link) : "/" },
        webpush: {
          fcmOptions: { link: link ? String(link) : "/" },
        },
      });

      // Tokens inválidos/expirados não derrubam a resposta — só ficam
      // registrados no log; o alerta interno (Firestore) já foi gravado de
      // qualquer forma antes desta chamada.
      resultado.responses.forEach((r, i) => {
        if (!r.success) console.warn("Falha ao enviar push pro token", tokens[i], r.error?.message);
      });

      return res.json({ success: true, successCount: resultado.successCount, failureCount: resultado.failureCount });
    } catch (error) {
      console.error("Error sending push:", error);
      res.status(500).json({ error: "Failed to send push" });
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
