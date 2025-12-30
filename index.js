// index.js
const https = require("https");

// Tu API key desde variables de entorno en Render
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

async function getLiveFootball() {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: "/sports/1/events/live", // ⚽ Fútbol en vivo
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";

    res.on("data", chunk => {
      data += chunk;
    });

    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        console.log("✅ Partidos en vivo:", JSON.stringify(json, null, 2));
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => {
    console.error("❌ Error en la petición:", err.message);
  });

  req.end();
}

// Ejecutar prueba
getLiveFootball();




  










