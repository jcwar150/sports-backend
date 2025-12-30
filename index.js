// index.js
const axios = require("axios");

// ⚽ Tu API key de fútbol (asegúrate de configurarla en Render)
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

async function testFootball() {
  try {
    const res = await axios.get("https://v3.football.api-sports.io/leagues", {
      headers: { "x-apisports-key": FOOTBALL_API_KEY }
    });

    console.log("✅ Respuesta Football API:", res.data);
  } catch (err) {
    console.error("❌ Error consultando Football API:");
    console.error("Status:", err.response?.status);
    console.error("Mensaje:", err.response?.data || err.message);
  }
}

// Ejecutar prueba
testFootball();




  










