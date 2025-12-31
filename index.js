const https = require('https');

function fetchStatistics(eventId) {
  const options = {
    method: 'GET',
    hostname: 'sportscore1.p.rapidapi.com',
    path: `/events/${eventId}/statistics`,
    headers: {
      'x-rapidapi-key': process.env.FOOTBALL_API_KEY,
      'x-rapidapi-host': 'sportscore1.p.rapidapi.com'
    }
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log("📊 Statistics:", JSON.stringify(JSON.parse(data), null, 2));
    });
  });

  req.end();
}

function fetchIncidents(eventId) {
  const options = {
    method: 'GET',
    hostname: 'sportscore1.p.rapidapi.com',
    path: `/events/${eventId}/incidents`,
    headers: {
      'x-rapidapi-key': process.env.FOOTBALL_API_KEY,
      'x-rapidapi-host': 'sportscore1.p.rapidapi.com'
    }
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const incidents = JSON.parse(data).data || [];
      incidents.forEach(inc => {
        console.log("📋 Incident:", inc.incident_type, "| Minuto:", inc.time, "| Texto:", inc.text);
      });
    });
  });

  req.end();
}

// Probar ambos para el mismo partido
const eventId = 132371;
fetchStatistics(eventId);
fetchIncidents(eventId);










  










