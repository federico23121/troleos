const puppeteer = require('puppeteer');

const SALA_LINK = process.env.SALA;
const NOMBRE_BASE = process.env.NOMBRE_BASE || 'Bot';
const MENSAJE = process.env.MENSAJE || 'Spam!';
const CANTIDAD_BOTS = Number(process.env.CANTIDAD_BOTS) || 15;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm';

const args = process.argv.slice(2);
const start = args[0] ? Number(args[0]) : 1;
const end = args[1] ? Number(args[1]) : CANTIDAD_BOTS;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('uncaughtException', (error) => {
    handleCriticalError(error, 'Excepción no capturada');
});

process.on('unhandledRejection', (reason, promise) => {
    handleCriticalError(new Error(reason), 'Promesa rechazada');
});

function handleCriticalError(error, context = '') {
    console.error(`❌ ERROR CRÍTICO ${context}:`, error);
    notifyDiscord(`🔴 **ERROR CRÍTICO** - Bot ${BOT_NICKNAME} cancelado. ${context}: ${error.message}`);
    
    // Forzar la cancelación del job con código de error
    process.exit(1);
}

async function crearBot(nombresito) {
    console.log("Iniciando bot, sala: " + SALA_LINK);
    
    let browser;
    let page;
    
    try {
        // Timeout para el lanzamiento del navegador
        browser = await Promise.race([
            puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al lanzar el navegador')), 30000))
        ]);
        
        page = await browser.newPage();
        
        // Timeout para cargar la página
        await Promise.race([
            page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al cargar la página')), 30000))
        ]);
        
        await page.waitForSelector('iframe');
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();
        
        if (!frame) {
            throw new Error('No se pudo acceder al iframe de Haxball');
        }
        
        // Escribir el nick con timeout
        console.log("Escribiendo el nombre de usuario...");
        const nickSelector = 'input[data-hook="input"][maxlength="25"]';
        
        try {
            await frame.waitForSelector(nickSelector, { timeout: 15000 });
            await frame.type(nickSelector, nombresito);
        } catch (error) {
            throw new Error(`No se pudo escribir el nickname: ${error.message}`);
        }
        
        // Hacer clic en "Join" con timeout
        console.log("Haciendo clic en 'Join'...");
        const joinButtonSelector = 'button[data-hook="ok"]';
        
        try {
            await frame.waitForSelector(joinButtonSelector, { timeout: 15000 });
            await frame.click(joinButtonSelector);
        } catch (error) {
            throw new Error(`No se pudo hacer clic en Join: ${error.message}`);
        }
        
        // Esperar que cargue la sala
        console.log("Esperando a que se cargue la sala...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verificar que estamos en la sala
        try {
            const chatSelector = 'input[data-hook="input"][maxlength="140"]';
            await frame.waitForSelector(chatSelector, { timeout: 10000 });
            console.log("✅ ¡Bot dentro de la sala!");
            await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);
        } catch (error) {
            throw new Error('No se pudo verificar el acceso a la sala');
        }
        
        
        // Mensaje al chat cada 5 segundos con manejo de errores
        const chatInterval = setInterval(async () => {
            try {
                await sendMessageToChat(frame, MENSAJE);
            } catch (error) {
                console.error("Error al enviar mensaje al chat:", error);
                clearInterval(chatInterval);
                throw new Error('Perdida de conexión con el chat');
            }
        }, 5000);
        
        // Movimiento anti-AFK con manejo de errores
        let moves = ['w', 'a', 's', 'd'];
        let moveIndex = 0;
        
        const moveInterval = setInterval(async () => {
            try {
                const key = moves[moveIndex % moves.length];
                console.log(`Presionando tecla: ${key}`);
                await page.keyboard.press(key);
                moveIndex++;
            } catch (error) {
                console.error("Error al presionar tecla:", error);
                clearInterval(moveInterval);
                throw new Error('Perdida de conexión con el juego');
            }
        }, 5000);
        
        // Verificar conexión cada 30 segundos
        const healthCheck = setInterval(async () => {
            try {
                const chatSelector = 'input[data-hook="input"][maxlength="140"]';
                await frame.waitForSelector(chatSelector, { timeout: 5000 });
                console.log("✅ Conexión activa");
            } catch (error) {
                console.error("❌ Fallo en verificación de conexión");
                clearInterval(healthCheck);
                clearInterval(chatInterval);
                clearInterval(moveInterval);
                throw new Error('Perdida de conexión con el servidor');
            }
        }, 30000);
        
        // Mantenerlo vivo 1 hora
        await new Promise(resolve => setTimeout(resolve, 3600000));
        
        // Limpiar intervalos
        clearInterval(chatInterval);
        clearInterval(moveInterval);
        clearInterval(healthCheck);
        
    } catch (error) {
        console.error("❌ Error durante la ejecución del bot:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot **${BOT_NICKNAME}**. Causa: ${error.message}`);
        
        // Limpiar recursos antes de salir
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Error al cerrar el navegador:", e);
            }
        }
        
        // Cancelar el job con código de error
        process.exit(1);
        
    } finally {
        console.log("Cerrando el bot.");
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Error al cerrar el navegador:", e);
            }
        }
        
        await notifyDiscord(`🟡 El bot **${BOT_NICKNAME}** ha terminado su ejecución.`);
    }
}

// Enviar mensaje a Discord
async function notifyDiscord(message) {
    if (!DISCORD_WEBHOOK_URL) return;
    
    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
        });
    } catch (e) {
        console.error("Error al enviar notificación a Discord:", e);
    }
}

// Enviar mensaje al chat
async function sendMessageToChat(frame, message) {
    try {
        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        await frame.waitForSelector(chatSelector, { timeout: 5000 });
        const chatInput = await frame.$(chatSelector);
        
        if (!chatInput) {
            throw new Error('No se encontró el input del chat');
        }
        
        await chatInput.click();
        await chatInput.type(message);
        await chatInput.press('Enter');
        console.log("Mensaje enviado:", message);
        
    } catch (e) {
        console.error("Error al enviar mensaje al chat:", e);
        throw e; // Re-lanzar el error para que sea manejado por el caller
    }
}

(async () => {
  const bots = [];
  // Introducir un pequeño retraso entre los bots
  for (let i = start; i <= end; i++) {
    bots.push(
      (async () => {
        await delay(i * 5000); // Esperamos un poco antes de lanzar cada bot (5 segundos entre cada bot)
        await crearBot(`${NOMBRE_BASE}_${i}`);
      })()
    );
  }
  await Promise.all(bots);
})();
