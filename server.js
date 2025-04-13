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

// Configuração dos certificados para a Gerencianet
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
    // Obter o token de autenticação
    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;

    if (!client_id || !client_secret) {
      throw new Error("CLIENT_ID ou CLIENT_SECRET não configurados.");
    }

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

    // Gerar um txid único
    const txid = uuidv4().replace(/-/g, "").slice(0, 26) + Date.now().toString(36).slice(0, 9);

    // Criar a cobrança Pix
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

    // Obter o QR Code
    const qrCodeResponse = await axios.get(
      `https://pix.api.efipay.com.br/v2/loc/${loc}/qrcode`,
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Retornar os dados do Pix
    res.json({
      qrCodeBase64: qrCodeResponse.data.imagemQrcode,
      pixString: qrCodeResponse.data.qrcode,
      txid: txid,
    });
  } catch (err) {
    console.error("Erro ao gerar PIX:", err.message);
    res.status(500).json({ erro: "Erro ao gerar PIX: " + err.message });
  }
});

// Rota para receber notificações da Gerencianet
app.post("/webhook", (req, res) => {
  try {
    const { pix } = req.body;
    if (pix && pix.length > 0) {
      const { txid, status } = pix[0];
      if (status === "CONCLUIDA") {
        paymentStatus[txid] = true;
        console.log(`Pagamento ${txid} confirmado`);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err.message);
    res.sendStatus(500);
  }
});

// Rota para o frontend verificar o status do pagamento
app.post("/check-payment", (req, res) => {
  try {
    const { txid } = req.body;
    if (!txid) {
      return res.status(400).json({ erro: "txid não fornecido" });
    }
    const isPaid = paymentStatus[txid] || false;
    res.json({ paid: isPaid });
  } catch (err) {
    console.error("Erro ao verificar pagamento:", err.message);
    res.status(500).json({ erro: "Erro ao verificar pagamento" });
  }
});

// Configurar a porta para a Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Pix rodando na porta ${PORT}`);
});