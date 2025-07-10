const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOM_URL = "https://www.haxball.com/play?c=psCuQmyFPYY"; // ¡Cambia esto!
const BOT_NICKNAME = "BotRelleno";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm"; // ¡Tu webhook!
// ----------------------

async function main() {
    console.log("🤖 Iniciando el bot de Haxball...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        console.log(`Navegando a la sala: ${HAXBALL_ROOM_URL}`);
        await page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' });

        await page.waitForSelector('iframe');
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();

console.log("Escribiendo el nombre de usuario...");
const nickSelector = 'input[data-hook="input"][maxlength="25"]';
await frame.waitForSelector(nickSelector, { timeout: 10000 });
await frame.type(nickSelector, BOT_NICKNAME);


        console.log("Haciendo clic en 'Join'...");
const joinButtonSelector = 'button[data-hook="ok"]';
await frame.waitForSelector(joinButtonSelector, { timeout: 10000 });
await frame.click(joinButtonSelector);

        await page.waitForFunction(() => !document.querySelector('iframe'), { timeout: 20000 });

        console.log("✅ ¡Bot dentro de la sala!");
        await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);

        // Esperamos un poco a que cargue la interfaz completa
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 🧠 Intervalo para enviar mensajes al chat cada 3 segundos
        setInterval(async () => {
            await sendMessageToChat(frame, "🤖 ¡Estoy vivo!");
        }, 3000);

        // 🧠 Movimiento anti-AFK
        let moves = ['w', 'a', 's', 'd'];
        let moveIndex = 0;
        setInterval(() => {
            const key = moves[moveIndex % moves.length];
            console.log(`Presionando tecla: ${key}`);
            page.keyboard.press(key);
            moveIndex++;
        }, 5000);

        // ⏳ Mantener el bot vivo por 1 hora
        await new Promise(resolve => setTimeout(resolve, 3600000));

    } catch (error) {
        console.error("❌ Error durante la ejecución del bot:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot. Causa: ${error.message}`);
    } finally {
        console.log("Cerrando el bot.");
        await browser.close();
    }
}

// 📤 Notificación a Discord
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

// 💬 Enviar mensaje al chat del juego
async function sendMessageToChat(frame, message) {
    try {
        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        await frame.waitForSelector(chatSelector, { timeout: 5000 });
        const chatInput = await frame.$(chatSelector);
        await chatInput.type(message);
        await chatInput.press('Enter');
        console.log("Mensaje enviado al chat:", message);
    } catch (e) {
        console.error("Error al enviar mensaje al chat:", e);
    }
}

main();
