require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json());

// Certificado e chave
const cert = fs.readFileSync("certificado.pem");
const key = fs.readFileSync("chave.pem");
const httpsAgent = new https.Agent({ cert, key });

let paymentStatus = {};

// Gerar cobrança
app.get("/pagar", async (req, res) => {
  try {
    const auth = await axios.post(
      `${process.env.GN_ENDPOINT}/v1/authorize`,
      {},
      {
        httpsAgent,
        auth: {
          username: process.env.GN_CLIENT_ID,
          password: process.env.GN_CLIENT_SECRET,
        },
      }
    );

    const access_token = auth.data.access_token;

    const txid = uuidv4().replace(/-/g, "").slice(0, 26) + Date.now().toString(36).slice(0, 9);

    const body = {
      calendario: { expiracao: 3600 },
      devedor: { cpf: "12345678909", nome: "Cliente Teste" },
      valor: { original: "0.01" },
      chave: "empregosparaoficial@gmail.com",
      solicitacaoPagador: "Gerar currículo",
    };

    const cob = await axios.put(
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

    const loc = cob.data.loc.id;

    const qr = await axios.get(
      `${process.env.GN_ENDPOINT}/v2/loc/${loc}/qrcode`,
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
    res.status(500).json({ erro: "Erro ao gerar PIX: " + (err.response?.data?.message || err.message) });
  }
});

// Webhook com log
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

// Checar pagamento
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pix API running on port ${PORT}`);
});
