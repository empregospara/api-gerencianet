require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const https = require("https");

const cert = fs.readFileSync("certificado.pem");
const key = fs.readFileSync("chave.pem");

const httpsAgent = new https.Agent({ cert, key });

async function registerWebhook() {
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

    const accessToken = tokenResponse.data.access_token;

    const response = await axios.put(
      `${process.env.GN_ENDPOINT}/v2/webhook/empregosparaoficial@gmail.com`,
      {
        webhookUrl: "https://pixempregospara.up.railway.app/webhook?ignorar=",
      },
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-skip-mtls-checking": "true",
        },
      }
    );

    console.log("✅ Webhook registrado com sucesso:", response.data);
  } catch (error) {
    console.error("❌ Erro ao registrar webhook:", error.response?.data || error.message);
  }
}

registerWebhook();
