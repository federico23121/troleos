const HaxballJS = require("haxball.js");
const https = require("https");
const { URL } = require("url");

// Configurar el token antes de crear la sala
const token = "thr1.AAAAAGh4YNUPSSzqkXybFQ.o3JxjkwFngs";
const webhookUrl =
  "https://discord.com/api/webhooks/1392972030026191019/Nyz7gdXqt-sc2gBl_eWdfikd_wN2EOgWUpjVYIoSvsGuFIYa_6TU9z9TDdaOcVXuiiFT"; // Asegúrate de que este sea tu webhook real

if (!token) {
  console.error(
    "❌ Error: No se encontró el token en las variables de entorno",
  );
  console.error(
    "💡 Asegúrate de tener una variable de entorno llamada 'Token' con tu token de HaxBall",
  );
  process.exit(1);
}

if (!webhookUrl) {
  console.error(
    "❌ Error: No se encontró el webhook URL en las variables de entorno",
  );
  console.error(
    "💡 Asegúrate de tener una variable de entorno llamada 'DISCORD_WEBHOOK_URL' con tu webhook de Discord",
  );
  process.exit(1);
}

console.log("🚀 Iniciando bot de HaxBall...");

// Crear la sala usando HBInit directamente
HaxballJS.then((HBInit) => {
  const room = HBInit({
    roomName: "🥐 Nueva liga busca equipos 🥐",
    maxPlayers: 16,
    public: true,
    noPlayer: true,
    token: token,
    geo: {
      code: "AR", // Código de país (ej. "AR" para Argentina)
      lat: -34.61, // Latitud (ej. Buenos Aires)
      lon: -58.42, // Longitud (ej. Buenos Aires)
    },
  });

  // Evento cuando la sala está lista
  room.onRoomLink = function (url) {
    console.log("✅ Sala creada exitosamente!");
    console.log("🔗 Link de la sala:", url);
  };

  // Evento cuando un jugador se une
  room.onPlayerJoin = function (player) {
    console.log(`🎯 Nuevo jugador: ${player.name} (ID: ${player.id})`);

    room.sendAnnouncement(`https://discord.gg/XEfb5xFW4Y`, null,0xef9119,"bold",2);

  };

  // Evento cuando un jugador se va
  room.onPlayerLeave = function (player) {
    console.log(`👋 Jugador salió: ${player.name} (ID: ${player.id})`);
  };

  // Evento para mensajes del chat
  room.onPlayerChat = function (player, message) {
    console.log(`💬 ${player.name}: ${message}`);
    return false; // Evita que el mensaje se muestre en el chat de la sala
  };

  // Manejo de errores
  room.onRoomError = function (error) {
    console.error("❌ Error en la sala:", error);
  };
}).catch((error) => {
  console.error("❌ Error al inicializar HaxBall:", error);
  console.error("💡 Verifica que el token sea válido");
  process.exit(1);
});
