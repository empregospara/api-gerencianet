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

const cert = fs.readFileSync(path.join(__dirname, "certificado.pem"));
const key = fs.readFileSync(path.join(__dirname, "chave.pem"));

const httpsAgent = new https.Agent({
  cert,
  key,
  rejectUnauthorized: false,
});

// Armazenar status de pagamento temporariamente (use um banco de dados em produção)
let paymentStatus = {};

app.get("/pagar", async (req, res) => {
  try {
    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;

    const basicAuth = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

    const tokenResponse = await axios.post(
      "https://pix.api.efipay.com.br/oauth/token",
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

    const txid = uuidv4().replace(/-/g, "").slice(0, 26) + Date.now().toString(36).slice(0, 9);

    const body = {
      calendario: { expiracao: 3600 },
      devedor: { cpf: "12345678909", nome: "Cliente Teste" },
      valor: { original: "0.01" },
      chave: "empregosparaoficial@gmail.com",
      solicitacaoPagador: "Gerar currículo",
    };

    const pixResponse = await axios.put(
      `https://pix.api.efipay.com.br/v2/cob/${txid}`,
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

    const qrCodeResponse = await axios.get(
      `https://pix.api.efipay.com.br/v2/loc/${loc}/qrcode`, // Linha corrigida: string fechada e endpoint completo
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    res.json({
      qrCodeBase64: qrCodeResponse.data.imagemQrcode,
      pixString: qrCodeResponse.data.qrcode,
      txid: txid, // Inclua o txid na resposta para uso no frontend
    });
  } catch (err) {
    console.error("Erro ao gerar PIX:", err.message);
    res.status(500).json({ erro: "Erro ao gerar PIX" });
  }
});

// Rota para receber notificações da Gerencianet
app.post('/webhook', (req, res) => {
  const { pix } = req.body;
  if (pix && pix.length > 0) {
    const { txid, status } = pix[0];
    if (status === 'CONCLUIDA') {
      paymentStatus[txid] = true;
      console.log(`Pagamento ${txid} confirmado`);
    }
  }
  res.sendStatus(200);
});

// Rota para o frontend verificar o status do pagamento
app.post('/check-payment', (req, res) => {
  const { txid } = req.body;
  const isPaid = paymentStatus[txid] || false;
  res.json({ paid: isPaid });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Pix rodando na porta ${PORT}`);
});