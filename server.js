require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const cors = require("cors");
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ AGENTE HTTPS SEM CERTIFICADO — COMPATÍVEL COM RENDER
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let paymentStatus = {};

// Gera cobrança Pix e QR Code
app.get("/pagar", async (req, res) => {
  try {
    const credentials = Buffer.from(
      `${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await axios.post(
      `${process.env.GN_ENDPOINT}/oauth/token`,
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

    const locId = cob.data.loc.id;

    const qr = await axios.get(
      `${process.env.GN_ENDPOINT}/v2/loc/${locId}/qrcode`,
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    // simula pagamento automático em 20s (apenas para dev/teste)
    setTimeout(() => {
      paymentStatus[txid] = true;
      console.log("✅ Pagamento confirmado para txid:", txid);
    }, 20000);

    res.json({
      txid,
      pixString: qr.data.qrcode,
      qrCodeBase64: qr.data.imagemQrcode,
    });
  } catch (err) {
    console.error("Erro ao gerar PIX:", err.response?.data || err.message);
    res.status(500).json({
      erro: "Erro ao gerar Pix",
    });
  }
});

// Verifica se pagamento foi confirmado (polling)
app.post("/check-payment", (req, res) => {
  const { txid } = req.body;
  if (!txid) return res.status(400).json({ erro: "txid não informado" });

  const pago = paymentStatus[txid] || false;
  res.json({ paid: pago });
});

// Inicializa servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Pix API rodando na porta ${PORT}`);
});
