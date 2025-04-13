require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let paymentStatus = {};

// Gera cobrança Pix
app.get("/pagar", async (req, res) => {
  try {
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
      `${process.env.GN_ENDPOINT}/v2/cob/${txid}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const locId = cob.data.loc.id;

    const qr = await axios.get(
      `${process.env.GN_ENDPOINT}/v2/loc/${locId}/qrcode`,
      {
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
      erro: "Erro ao gerar PIX: " + (err.response?.data?.message || err.message),
    });
  }
});

// Webhook básico — responde sempre 200 OK
app.post("/webhook", (req, res) => {
  console.log("🟢 Webhook ping recebido:", new Date().toISOString());
  res.status(200).json({ ok: true });
});

// Verificação manual
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Pix API running on port ${PORT}`);
});
