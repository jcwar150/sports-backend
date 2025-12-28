const axios = require("axios");

const ONESIGNAL_APP_ID = "886fb758-5e13-44df-87d4-3f3590e11491";
const ONESIGNAL_API_KEY = "TU_REST_API_KEY_AQUI"; // la nueva que generaste

async function testNotification() {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      contents: { en: "Prueba de notificación desde backend" }
    }, {
      headers: {
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Notificación enviada:", res.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

testNotification();






