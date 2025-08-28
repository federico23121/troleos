const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOMS = process.env.HAXBALL_ROOMS.split(','); // Array de salas desde workflow
const JOB_INDEX = parseInt(process.env.JOB_INDEX || 0);
const BOT_NICKNAME = process.env.JOB_ID || "bot";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm"; // Tu webhook
// ----------------------

// Selecciona la sala correspondiente en loop
function getRoomForJob() {
    if (!HAXBALL_ROOMS.length) return '';
    return HAXBALL_ROOMS[JOB_INDEX % HAXBALL_ROOMS.length].trim();
}

// Función para manejar errores críticos y cancelar el job
function handleCriticalError(error, context = '') {
    console.error(`❌ ERROR CRÍTICO ${context}:`, error);
    notifyDiscord(`🔴 **ERROR CRÍTICO** - Bot ${BOT_NICKNAME} cancelado. ${context}: ${error.message}`);
    process.exit(1);
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => handleCriticalError(error, 'Excepción no capturada'));
process.on('unhandledRejection', (reason) => handleCriticalError(new Error(reason), 'Promesa rechazada'));

async function main() {
    const HAXBALL_ROOM_URL = getRoomForJob();
    console.log(`🤖 Bot ${BOT_NICKNAME} entrando a: ${HAXBALL_ROOM_URL}`);

    let browser, page;

    try {
        browser = await Promise.race([
            puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al lanzar el navegador')), 30000))
        ]);

        page = await browser.newPage();

        const haxballCountryCodes = ["uy","ar","br","cn","ly","me","vi","cl","cy"];
        const randomCode = haxballCountryCodes[Math.floor(Math.random() * haxballCountryCodes.length)];
        await page.evaluateOnNewDocument((code) => {
            localStorage.setItem("geo", JSON.stringify({ lat: -34.6504, lon: -58.3878, code: code || 'ar' }));
        }, randomCode);

        await Promise.race([
            page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al cargar la página')), 30000))
        ]);

        await page.waitForSelector('iframe');
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();

        if (!frame) throw new Error('No se pudo acceder al iframe de Haxball');

        console.log("Escribiendo el nombre de usuario...");
        const nickSelector = 'input[data-hook="input"][maxlength="25"]';
        await frame.waitForSelector(nickSelector, { timeout: 15000 });
        const nickInput = await frame.$(nickSelector);
        if (!nickInput) throw new Error('No se encontró el input del nickname');
        await nickInput.click();
        await nickInput.type(BOT_NICKNAME);
        await nickInput.press('Enter');

        // Esperar unos segundos a que aparezca el captcha
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const onlyHumansButton = await frame.waitForSelector('button', { timeout: 5000 });
            await onlyHumansButton.click();
            console.log("✅ Captcha 'Only humans' clickeado automáticamente");
        } catch (e) {
            console.log("ℹ️ No apareció captcha o ya fue completado");
        }

        console.log("Haciendo clic en 'Join'...");
        const joinButtonSelector = 'button[data-hook="ok"]';
        await frame.waitForSelector(joinButtonSelector, { timeout: 15000 });
        await frame.click(joinButtonSelector);

        console.log("Esperando a que cargue la sala...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        await frame.waitForSelector(chatSelector, { timeout: 10000 });
        console.log("✅ ¡Bot dentro de la sala!");
        await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);

        // Mensaje inicial
        await sendMessageToChat(frame, process.env.LLAMAR_ADMIN);

        // Mensaje repetido cada 5 segundos
        const chatInterval = setInterval(async () => {
            try {
                await sendMessageToChat(frame, process.env.MENSAJE);
            } catch (error) {
                console.error("Error al enviar mensaje al chat:", error);
                clearInterval(chatInterval);
                throw new Error('Perdida de conexión con el chat');
            }
        }, 5000);

        // Anti-AFK
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

        // Health check
        const healthCheck = setInterval(async () => {
            try {
                await frame.waitForSelector(chatSelector, { timeout: 5000 });
                console.log("✅ Conexión activa");
            } catch (error) {
                console.error("❌ Fallo en verificación de conexión");
                clearInterval(chatInterval);
                clearInterval(moveInterval);
                clearInterval(healthCheck);
                throw new Error('Perdida de conexión con el servidor');
            }
        }, 30000);

        // Mantener vivo 1 hora
        await new Promise(resolve => setTimeout(resolve, 3600000));
        clearInterval(chatInterval);
        clearInterval(moveInterval);
        clearInterval(healthCheck);

    } catch (error) {
        console.error("❌ Error durante la ejecución del bot:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot **${BOT_NICKNAME}**. Causa: ${error.message}`);
        if (browser) await browser.close();
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await notifyDiscord(`🟡 El bot **${BOT_NICKNAME}** ha terminado su ejecución.`);
    }
}

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

async function sendMessageToChat(frame, message) {
    try {
        if (!message) return;
        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        await frame.waitForSelector(chatSelector, { timeout: 5000 });
        const chatInput = await frame.$(chatSelector);
        if (!chatInput) throw new Error('No se encontró el input del chat');
        await chatInput.click();
        await chatInput.type(message);
        await chatInput.press('Enter');
        console.log("Mensaje enviado:", message);
    } catch (e) {
        console.error("Error al enviar mensaje al chat:", e);
        throw e;
    }
}

let intentos = 0;
const MAX_INTENTOS = 1000;

async function iniciarBotConReintentos() {
    while (intentos < MAX_INTENTOS) {
        try {
            intentos++;
            console.log(`🔁 Intento ${intentos} de ${MAX_INTENTOS}`);
            await main();
            break;
        } catch (error) {
            console.error(`❌ Intento ${intentos} fallido:`, error.message);
            await notifyDiscord(`🔴 Fallo en intento ${intentos} para el bot **${BOT_NICKNAME}**. Error: ${error.message}`);
            if (intentos >= MAX_INTENTOS) {
                await notifyDiscord(`❌ El bot **${BOT_NICKNAME}** falló tras ${MAX_INTENTOS} intentos.`);
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

iniciarBotConReintentos();
