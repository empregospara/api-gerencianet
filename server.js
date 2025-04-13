require("dotenv").config();
const fs = require("fs");
const https = require("https");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Load the .p12 certificate from the environment variable
const p12Path = path.join(__dirname, process.env.GN_CERT); // "producao-546000.p12"
const p12Buffer = fs.readFileSync(p12Path);

const httpsAgent = new https.Agent({
  pfx: p12Buffer,
  passphrase: "", // Add passphrase if your .p12 file is password-protected
  rejectUnauthorized: false,
});

// Temporary storage for payment status
let paymentStatus = {};

app.get("/pagar", async (req, res) => {
  try {
    // Retrieve credentials from environment variables
    const client_id = process.env.GN_CLIENT_ID;
    const client_secret = process.env.GN_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      throw new Error("GN_CLIENT_ID or GN_CLIENT_SECRET not configured.");
    }

    const basicAuth = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

    // Get authentication token
    const tokenResponse = await axios.post(
      `${process.env.GN_ENDPOINT}/oauth/token`,
      { grant_type: "client_credentials" },
      {
        httpsAgent,
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const access_token = tokenResponse.data.access_token;

    // Generate a unique txid
    const txid = uuidv4().replace(/-/g, "").slice(0, 26) + Date.now().toString(36).slice(0, 9);

    // Create Pix charge
    const body = {
      calendario: { expiracao: 3600 },
      devedor: { cpf: "12345678909", nome: "Cliente Teste" },
      valor: { original: "0.01" },
      chave: "empregosparaoficial@gmail.com",
      solicitacaoPagador: "Gerar currículo",
    };

    const pixResponse = await axios.put(
      `${process.env.GN_ENDPOINT}/v2/cob/${txid}`,
      body,
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const loc = pixResponse.data.loc.id;

    // Get QR code
    const qrCodeResponse = await axios.get(
      `${process.env.GN_ENDPOINT}/v2/loc/${loc}/qrcode`,
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Return Pix data
    res.json({
      qrCodeBase64: qrCodeResponse.data.imagemQrcode,
      pixString: qrCodeResponse.data.qrcode,
      txid: txid,
    });
  } catch (err) {
    console.error("Error generating Pix:", err.message);
    res.status(500).json({ erro: "Erro ao gerar PIX: " + err.message });
  }
});

// Webhook to receive payment notifications
app.post("/webhook", (req, res) => {
  try {
    const { pix } = req.body;
    if (pix && pix.length > 0) {
      const { txid, status } = pix[0];
      if (status === "CONCLUIDA") {
        paymentStatus[txid] = true;
        console.log(`Payment ${txid} confirmed`);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(500);
  }
});

// Endpoint to check payment status
app.post("/check-payment", (req, res) => {
  try {
    const { txid } = req.body;
    if (!txid) {
      return res.status(400).json({ erro: "txid not provided" });
    }
    const isPaid = paymentStatus[txid] || false;
    res.json({ paid: isPaid });
  } catch (err) {
    console.error("Error checking payment:", err.message);
    res.status(500).json({ erro: "Error checking payment" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pix API running on port ${PORT}`);
});