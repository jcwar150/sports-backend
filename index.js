// index.js
const axios = require("axios");

// Variable de entorno (asegúrate de configurarla en Render)
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

async function testFootball() {
  try {
    const res = await axios.get("https://v3.football.api-sports.io/leagues", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });

    console.log("✅ Respuesta Football API:", res.data);
  } catch (err) {
    console.error("❌ Error consultando Football API:", err.response?.status, err.message);
  }
}

// Ejecutar prueba
testFootball();




  










