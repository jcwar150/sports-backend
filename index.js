function getLiveEvents(sportId) {
  const options = {
    method: "GET",
    hostname: "sportscore1.p.rapidapi.com",
    path: `/sports/${sportId}/events/live`,
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": "sportscore1.p.rapidapi.com"
    }
  };

  const req = https.request(options, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);

        json.data.forEach(event => {
          const home = event.home_team?.name || "Home";
          const away = event.away_team?.name || "Away";
          const score = `${event.home_score?.current || 0} - ${event.away_score?.current || 0}`;
          const status = event.status_more || "";

          console.log("📊 Partido:", home, "vs", away, "| Estado:", status, "| Marcador:", score);

          // Mostrar todo el objeto statistics si existe
          console.log("📋 Statistics crudo:", JSON.stringify(event.statistics, null, 2));

          // Mostrar incidents crudos si existen
          if (event.incidents) {
            console.log("📋 Incidents crudos:", JSON.stringify(event.incidents, null, 2));
          } else {
            console.log("📋 No hay incidents en este snapshot.");
          }
        });
      } catch (err) {
        console.error("❌ Error parseando respuesta live:", err.message);
      }
    });
  });

  req.on("error", err => console.error("❌ Error en la petición live:", err.message));
  req.end();
}













  










