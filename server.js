require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let paymentStatus = {};

app.get("/pagar", async (req, res) => {
  try {
    // Usar o token Bearer fornecido diretamente
    const access_token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiY2xpZW50SWQiOiJDbGllbnRfSWRfYTI3MjMxZDg4MjE3MzNiNjJjYmRmNjhiZWE4MjZkNzIyNTc4MmFlMyIsImFjY291bnQiOjU0NjAwMCwiYWNjb3VudF9jb2RlIjoiZWU3YmJiYTg1NzI2NDM0NjQ2ZWFhOTVjMGZkNmJjMzAiLCJzY29wZXMiOlsiY29iLnJlYWQiLCJjb2Iud3JpdGUiLCJjb2J2LnJlYWQiLCJjb2J2LndyaXRlIiwiZ24uYmFsYW5jZS5yZWFkIiwiZ24ucGl4LmV2cC5yZWFkIiwiZ24ucGl4LmV2cC53cml0ZSIsImduLnBpeC5zZW5kLnJlYWQiLCJnbi5yZXBvcnRzLnJlYWQiLCJnbi5yZXBvcnRzLndyaXRlIiwiZ24uc2V0dGluZ3MucmVhZCIsImduLnNldHRpbmdzLndyaXRlIiwiZ24uc3BsaXQucmVhZCIsImduLnNwbGl0LndyaXRlIiwibG90ZWNvYnYucmVhZCIsImxvdGVjb2J2LndyaXRlIiwicGF5bG9hZGxvY2F0aW9uLnJlYWQiLCJwYXlsb2FkbG9jYXRpb24ud3JpdGUiLCJwaXgucmVhZCIsInBpeC5zZW5kIiwicGl4LndyaXRlIiwid2ViaG9vay5yZWFkIiwid2ViaG9vay53cml0ZSJdLCJleHBpcmVzSW4iOjM2MDAsImNvbmZpZ3VyYXRpb24iOnsieDV0I1MyNTYiOiJ5VFZoUkdSWnUyMFZyMkRaaDNpUkIxUllBR0JFY0pOUjZWMzJOTk1vdHVjPSJ9LCJpYXQiOjE3NDQ1MTQzNzksImV4cCI6MTc0NDUxNzk3OX0.QHEgeT73DdVs4HvqyllPGdmbj1-AUr2bD4lcixM9jMA";

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
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    res.json({
      qrCodeBase64: qrCodeResponse.data.imagemQrcode,
      pixString: qrCodeResponse.data.qrcode,
      txid: txid,
    });
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ erro: "Erro ao gerar PIX: " + (err.response?.data?.message || err.message) });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Pix API running on port ${PORT}`);
});