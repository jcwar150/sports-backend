// index.js
const axios = require("axios");

// Variables de entorno (asegúrate de configurarlas en Render)
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const BASKETBALL_API_KEY = process.env.BASKETBALL_API_KEY;

// ⚽ Probar API de Fútbol
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

// 🏀 Probar API de Básquet
async function testBasketball() {
  try {
    const res = await axios.get("https://v1.basketball.api-sports.io/leagues", {
      headers: { "x-apisports-key": BASKETBALL_API_KEY }
    });
    console.log("✅ Respuesta Basketball API:", res.data);
  } catch (err) {
    console.error("❌ Error consultando Basketball API:", err.response?.status, err.message);
  }
}

// Ejecutar pruebas
(async () => {
  await testFootball();
  await testBasketball();
})();





  










