const axios = require("axios");

const ONESIGNAL_APP_ID = "886fb758-5e13-44df-87d4-3f3590e11491"; // tu App ID
const ONESIGNAL_API_KEY = "os_v2_app_rbx3owc6cncn7b6uh42zbyiusfkfffiogz2esn4vkct2dpsyyovmt7dzo4bqfxmwvgu5mz67bz6a7aymepxhzcaunfoqdvjl4aaeooy"; // tu nueva API Key v2

async function testNotification() {
  try {
    const res = await axios.post("https://onesignal.com/api/v1/notifications", {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      contents: { en: "Prueba con API Key v2 ✅" }
    }, {
      headers: {
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`, // aquí va la clave v2
        "Content-Type": "application/json"
      }
    });

    console.log("✅ Notificación enviada:", res.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

testNotification();








