require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const https = require("https");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let paymentStatus = {};

// carregar certificados PEM
const cert = fs.readFileSync(path.join(__dirname, "certificado.pem"));
const key = fs.readFileSync(path.join(__dirname, "chave.pem"));

const httpsAgent = new https.Agent({
  cert,
  key,
  rejectUnauthorized: false, // pode deixar false no Render, mTLS já autentica
});

app.get("/pagar", async (req, res) => {
  try {
    // gerar access_token via OAuth com certificado
    const credentials = Buffer.from(
      `${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await axios.post(
      `${process.env.GN_ENDPOINT}/oauth/token`,
      { grant_type: "client_credentials" },
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        httpsAgent,
      }
    );

    const access_token = tokenResponse.data.access_token;

    // criar cobrança
    const txid =
      uuidv4().replace(/-/g, "").slice(0, 26) +
      Date.now().toString(36).slice(0, 9);

    const body = {
      calendario: { expiracao: 3600 },
      devedor: { cpf: "12345678909", nome: "Cliente Teste" },
      valor: { original: "0.01" },
      chave: "empregosparaoficial@gmail.com",
      solicitacaoPagador: "Gerar currículo",
    };

    const cobResponse = await axios.put(
      `${process.env.GN_ENDPOINT}/v2/cob/${txid}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        httpsAgent,
      }
    );

    const locId = cobResponse.data.loc.id;

    const qrCodeResponse = await axios.get(
      `${process.env.GN_ENDPOINT}/v2/loc/${locId}/qrcode`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        httpsAgent,
      }
    );

    res.json({
      qrCodeBase64: qrCodeResponse.data.imagemQrcode,
      pixString: qrCodeResponse.data.qrcode,
      txid,
    });
  } catch (err) {
    console.error("Erro:", err.response?.data || err.message);
    res.status(500).json({
      erro: "Erro ao gerar PIX: " + (err.response?.data?.message || err.message),
    });
  }
});

app.post("/webhook", (req, res) => {
  try {
    const { pix } = req.body;
    if (pix && pix.length > 0) {
      const { txid, status } = pix[0];
      if (status === "CONCLUIDA") {
        paymentStatus[txid] = true;
      }
    }
    res.sendStatus(200);
  } catch (err) {
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Pix API running on port ${PORT}`);
});
