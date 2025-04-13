require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Carrega os certificados para HTTPS + mTLS
const cert = fs.readFileSync(path.join(__dirname, "certificado.pem"));
const key = fs.readFileSync(path.join(__dirname, "chave.pem"));
const httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });

let paymentStatus = {};

app.get("/pagar", async (req, res) => {
  try {
    const credentials = Buffer.from(
      `${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await axios.post(
      "https://pix.api.efipay.com.br/oauth/token",
      { grant_type: "client_credentials" },
      {
        httpsAgent,
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      }
    );

    const access_token = tokenResponse.data.access_token;

    const txid =
      uuidv4().replace(/-/g, "").slice(0, 26) +
      Date.now().toString(36).slice(0, 9);

    const body = {
      calendario: { expiracao: 3600 },
      devedor: { cpf: "01810422230", nome: "Cliente Teste" },
      valor: { original: "0.01" },
      chave: "empregosparaoficial@gmail.com",
      solicitacaoPagador: "Gerar currículo",
    };

    const cob = await axios.put(
      "https://pix.api.efipay.com.br/v2/cob/" + txid,
      body,
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const locId = cob.data.loc.id;

    const qr = await axios.get(
      `https://pix.api.efipay.com.br/v2/loc/${locId}/qrcode`,
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    res.json({
      qrCodeBase64: qr.data.imagemQrcode,
      pixString: qr.data.qrcode,
      txid: txid,
    });
  } catch (err) {
    console.error("Erro ao gerar PIX:", err.response?.data || err.message);
    res.status(500).json({
      erro:
        "Erro ao gerar PIX: " +
        (err.response?.data?.message || err.message),
    });
  }
});

app.post("/webhook", (req, res) => {
  try {
    console.log("Webhook recebeu:", JSON.stringify(req.body, null, 2));
    const { pix } = req.body;
    if (pix && pix.length > 0) {
      const { txid, status } = pix[0];
      if (status === "CONCLUIDA") {
        paymentStatus[txid] = true;
        console.log("Pagamento confirmado para txid:", txid);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});

app.post("/check-payment", (req, res) => {
  try {
    const { txid } = req.body;
    if (!txid) return res.status(400).json({ erro: "txid not provided" });
    const isPaid = paymentStatus[txid] || false;
    res.json({ paid: isPaid });
  } catch (err) {
    res.status(500).json({ erro: "Error checking payment" });
  }
});

// 🔥 HTTPS + certificados ativos para aceitar chamadas do webhook EfiPay
const PORT = process.env.PORT || 10000;
https.createServer({ key, cert }, app).listen(PORT, () => {
  console.log(`Pix API HTTPS running on port ${PORT}`);
});
