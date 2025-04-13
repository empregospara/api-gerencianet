require("dotenv").config();
const fs = require("fs");
const https = require("https");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());

const cert = fs.readFileSync(path.join(__dirname, "certificado.pem"));
const key = fs.readFileSync(path.join(__dirname, "chave.pem"));

const httpsAgent = new https.Agent({ cert, key });

async function gerarToken() {
    const credentials = Buffer.from(`${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`).toString("base64");
    const response = await axios.post(`${process.env.GN_ENDPOINT}/oauth/token`, 
        { grant_type: "client_credentials" }, 
        {
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/json"
            },
            httpsAgent
        });
    return response.data.access_token;
}

function gerarTxidValido() {
    const base = uuidv4().replace(/-/g, '').slice(0, 26);
    return base + Date.now().toString(36).slice(0, 9);
}

async function gerarCobrancaPix() {
    const txid = gerarTxidValido(); // garante de 26 a 35 caracteres
    const access_token = await gerarToken();
    const payload = {
        calendario: { expiracao: 3600 },
        devedor: { cpf: "12345678909", nome: "Cliente Teste" },
        valor: { original: "1.00" },
        chave: "empregosparaoficial@gmail.com",
        solicitacaoPagador: "Gerar currículo",
    };

    const response = await axios.put(
        `${process.env.GN_ENDPOINT}/v2/cob/${txid}`,
        payload,
        {
            headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
            },
            httpsAgent,
        }
    );

    const loc = response.data.loc.id;

    const qrResponse = await axios.get(`${process.env.GN_ENDPOINT}/v2/loc/${loc}/qrcode`, {
        headers: { Authorization: `Bearer ${access_token}` },
        httpsAgent,
    });

    return qrResponse.data;
}

app.get("/pagar", async (req, res) => {
    try {
        const dados = await gerarCobrancaPix();
        res.json({
            qr_code: dados.qr_code,
            imagem_base64: dados.imagemQrcode,
        });
    } catch (err) {
        console.error(err?.response?.data || err.message);
        res.status(500).json({ erro: "Erro ao gerar Pix" });
    }
});

app.listen(3000, () => console.log("API Pix rodando na porta 3000"));
