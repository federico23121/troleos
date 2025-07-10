const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const HAXBALL_ROOM_URL = "https://www.haxball.com/play?c=2kMEWKTJ7UQ";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm";

const BOT_COUNT = 3; // Cambiá este número para más o menos bots

async function main() {
    for (let i = 1; i <= BOT_COUNT; i++) {
        startBot(`thomazz.♻️🌎${i}`);
    }
}

async function startBot(nick) {
    console.log(`🤖 Iniciando ${nick}...`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        await page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' });

        await page.waitForSelector('iframe');
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();

        const nickSelector = 'input[data-hook="input"][maxlength="25"]';
        await frame.waitForSelector(nickSelector, { timeout: 10000 });
        await frame.type(nickSelector, nick);

        const joinButtonSelector = 'button[data-hook="ok"]';
        await frame.waitForSelector(joinButtonSelector, { timeout: 10000 });
        await frame.click(joinButtonSelector);

        console.log(`${nick} está entrando a la sala...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log(`✅ ${nick} entró a la sala.`);
        await notifyDiscord(`🟢 **${nick}** ha entrado a la sala.`);

        // Enviar mensaje al chat cada 3 segundos
        setInterval(async () => {
            await sendMessageToChat(frame, `Soy gay`);
        }, 3000);

        // Mover para evitar ser AFK
        let moves = ['w', 'a', 's', 'd'];
        let moveIndex = 0;
        setInterval(() => {
            const key = moves[moveIndex % moves.length];
            console.log(`${nick} presionando tecla: ${key}`);
            page.keyboard.press(key);
            moveIndex++;
        }, 5000);

        // Mantener el bot vivo por 1 hora
        await new Promise(resolve => setTimeout(resolve, 3600000));

    } catch (error) {
        console.error(`❌ Error en ${nick}:`, error);
        await notifyDiscord(`🔴 Error en **${nick}**: ${error.message}`);
    } finally {
        console.log(`Cerrando ${nick}.`);
        await browser.close();
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
        const chatSelector = 'input[data-hook="input"][maxlength="140"]';
        await frame.waitForSelector(chatSelector, { timeout: 5000 });
        const chatInput = await frame.$(chatSelector);
        await chatInput.type(message);
        await chatInput.press('Enter');
        console.log("Mensaje enviado:", message);
    } catch (e) {
        console.error("Error al enviar mensaje al chat:", e);
    }
}

main();
