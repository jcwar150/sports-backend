require('dotenv').config();
const axios = require('axios');

async function main() {
  await axios.post("https://onesignal.com/api/v1/notifications", {
    app_id: "886fb758-5e13-44df-87d4-3f3590e11491",
    included_segments: ["All"],
    contents: { en: "Prueba de notificación" }
  }, {
    headers: {
      "Authorization": `Basic TU_REST_API_KEY`,
      "Content-Type": "application/json"
    }
  });

  console.log("✅ Notificación enviada");
}

main();







