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
});

async function gerarToken() {
  const credentials = Buffer.from(`${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`).toString("base64");
  const response = await axios({
    method: "POST",
    url: `${process.env.GN_ENDPOINT}/oauth/token`,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    httpsAgent,
    data: { grant_type: "client_credentials" },
  });
  return response.data.access_token;
}

async function gerarCobrancaPix() {
  const txid = uuidv4().replace(/-/g, "").slice(0, 26);
  const access_token = await gerarToken();
  const payload = {
    calendario: { expiracao: 3600 },
    devedor: { cpf: "12345678909", nome: "Cliente Teste" },
    valor: { original: "1.00" },
    chave: "empregosparaoficial@gmail.com",
    solicitacaoPagador: "Gerar currículo",
  };

  const response = await axios({
    method: "PUT",
    url: `${process.env.GN_ENDPOINT}/v2/cob/${txid}`,
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    httpsAgent,
    data: payload,
  });

  const location = response.data.loc.id;

  const qrResponse = await axios({
    method: "GET",
    url: `${process.env.GN_ENDPOINT}/v2/loc/${location}/qrcode`,
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    httpsAgent,
  });

  return {
    qr_code: qrResponse.data.imagemQrcode,
    pixCopiaECola: qrResponse.data.qr_code, // <- aqui está o código correto agora
  };
}

app.get("/pagar", async (req, res) => {
  try {
    const dados = await gerarCobrancaPix();
    res.json(dados);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ erro: "Erro ao gerar Pix" });
  }
});

app.listen(3000, () => console.log("API Pix rodando na porta 3000"));
