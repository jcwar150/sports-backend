const https = require("https");

// Función genérica para consultar la API
function fetchRapidAPI(path) {
  const options = {
    method: "GET",
    hostname: "sportapi7.p.rapidapi.com",
    port: null,
    path: path,
    headers: {
      "x-rapidapi-key": process.env.FOOTBALL_API_KEY, // ✅ tu API key del environment
      "x-rapidapi-host": "sportapi7.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        console.log("✅ Respuesta:", JSON.stringify(json, null, 2));
        // Aquí luego aplicas tus condiciones (prórrogas, desbalanceados, etc.)
      } catch (err) {
        console.error("❌ Error parseando respuesta:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición:", err.message));
  req.end();
}

// --- Loop cada 5 minutos ---
setInterval(() => {
  console.log("🔄 Consultando partidos de básquet en vivo...");
  fetchRapidAPI("/api/v1/sport/basketball/events/live");
}, 5 * 60 * 1000);

