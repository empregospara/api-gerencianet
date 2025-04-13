require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const https = require("https");

const cert = fs.readFileSync("certificado.pem");
const key = fs.readFileSync("chave.pem");

const httpsAgent = new https.Agent({ cert, key });

async function registerWebhook() {
  try {
    const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiY2xpZW50SWQiOiJDbGllbnRfSWRfYTI3MjMxZDg4MjE3MzNiNjJjYmRmNjhiZWE4MjZkNzIyNTc4MmFlMyIsImFjY291bnQiOjU0NjAwMCwiYWNjb3VudF9jb2RlIjoiZWU3YmJiYTg1NzI2NDM0NjQ2ZWFhOTVjMGZkNmJjMzAiLCJzY29wZXMiOlsiY29iLnJlYWQiLCJjb2Iud3JpdGUiLCJjb2J2LnJlYWQiLCJjb2J2LndyaXRlIiwiZ24uYmFsYW5jZS5yZWFkIiwiZ24ucGl4LmV2cC5yZWFkIiwiZ24ucGl4LmV2cC53cml0ZSIsImduLnBpeC5zZW5kLnJlYWQiLCJnbi5yZXBvcnRzLnJlYWQiLCJnbi5yZXBvcnRzLndyaXRlIiwiZ24uc2V0dGluZ3MucmVhZCIsImduLnNldHRpbmdzLndyaXRlIiwiZ24uc3BsaXQucmVhZCIsImduLnNwbGl0LndyaXRlIiwibG90ZWNvYnYucmVhZCIsImxvdGVjb2J2LndyaXRlIiwicGF5bG9hZGxvY2F0aW9uLnJlYWQiLCJwYXlsb2FkbG9jYXRpb24ud3JpdGUiLCJwaXgucmVhZCIsInBpeC5zZW5kIiwicGl4LndyaXRlIiwid2ViaG9vay5yZWFkIiwid2ViaG9vay53cml0ZSJdLCJleHBpcmVzSW4iOjM2MDAsImNvbmZpZ3VyYXRpb24iOnsieDV0I1MyNTYiOiJ5VFZoUkdSWnUyMFZyMkRaaDNpUkIxUllBR0JFY0pOUjZWMzJOTk1vdHVjPSJ9LCJpYXQiOjE3NDQ1NjQ0MzUsImV4cCI6MTc0NDU2ODAzNX0.do91c3kX9pySQbHPkkOcrhFv0Au8axXzSS6x58DTn5c";

    const response = await axios.put(
      `${process.env.GN_ENDPOINT}/v2/webhook/empregosparaoficial@gmail.com`,
      {
        webhookUrl: "https://api-gerencianet.onrender.com/webhook",
      },
      {
        httpsAgent,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-skip-mtls-checking": "true"
        },
      }
    );

    console.log("Webhook registrado com sucesso:", response.data);
  } catch (error) {
    console.error("Erro ao registrar webhook:", error.response?.data || error.message);
  }
}

registerWebhook();
