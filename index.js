const https = require("https");

const options = {
  method: "GET",
  hostname: "sportapi7.p.rapidapi.com",
  port: null,
  path: "/api/v1/sport/football/events/live", // ⚽ partidos en vivo de fútbol
  headers: {
    "x-rapidapi-key": process.env.FOOTBALL_API_KEY,
    "x-rapidapi-host": "sportapi7.p.rapidapi.com"
  }
};

const req = https.request(options, res => {
  let data = "";
  res.on("data", chunk => (data += chunk));
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log("🔍 Respuesta completa:", JSON.stringify(json, null, 2));
    } catch (err) {
      console.error("❌ Error parseando respuesta:", err.message);
    }
  });
});

req.on("error", err => console.error("❌ Error en la petición:", err.message));
req.end();


