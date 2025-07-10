// Usamos puppeteer-extra y el plugin de stealth para evitar ser detectados
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- CONFIGURACIÓN ---
const HAXBALL_ROOM_URL = "https://www.haxball.com/play?c=psCuQmyFPYY"; // ¡Cámbiala por la URL de tu sala!
const BOT_NICKNAME = "BotRelleno";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1393006720237961267/lxg_qUjPdnitvXt-aGzAwthMMwNbXyZIbPcgRVfGCSuLldynhFHJdsyC4sSH-Ymli5Xm"; // ¡Pon aquí tu webhook!
// --------------------


async function main() {
    console.log("🤖 Iniciando el bot de Haxball...");
    const browser = await puppeteer.launch({
        headless: true, // true para que no se vea el navegador, false para depurar
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Argumentos para que funcione en GitHub Actions
    });

    const page = await browser.newPage();

    try {
        console.log(`Navegando a la sala: ${HAXBALL_ROOM_URL}`);
        await page.goto(HAXBALL_ROOM_URL, { waitUntil: 'networkidle2' });

        // Esperar a que el iframe del lobby cargue
        await page.waitForSelector('iframe');
        const iframeElement = await page.$('iframe');
        const frame = await iframeElement.contentFrame();

        // Interactuar dentro del iframe
        console.log("Escribiendo el nombre de usuario...");
        await frame.waitForSelector('#nick', { timeout: 10000 });
        await frame.type('#nick', BOT_NICKNAME);

        console.log("Haciendo clic en 'Join'...");
        await frame.click('#join');

        // Esperar a entrar a la sala (verificando que desaparece el lobby)
        await page.waitForFunction(() => !document.querySelector('iframe'), { timeout: 20000 });
        
        console.log("✅ ¡Bot dentro de la sala!");

        // Enviar notificación a Discord
        await notifyDiscord(`🟢 El bot **${BOT_NICKNAME}** ha entrado a la sala.`);

        // Simular movimiento cada 5 segundos para no ser AFK
        let moves = ['w', 'a', 's', 'd'];
        let moveIndex = 0;
        setInterval(() => {
            const key = moves[moveIndex % moves.length];
            console.log(`Presionando tecla: ${key}`);
            page.keyboard.press(key);
            moveIndex++;
        }, 5000); // 5000 ms = 5 segundos

        // Dejar el bot corriendo por un tiempo (ej. 1 hora) para no agotar los recursos de GitHub Actions
        await new Promise(resolve => setTimeout(resolve, 3600000)); // 1 hora

    } catch (error) {
        console.error("❌ Error durante la ejecución del bot:", error);
        await notifyDiscord(`🔴 Error al intentar conectar el bot. Causa: ${error.message}`);
    } finally {
        console.log("Cerrando el bot.");
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

main();
