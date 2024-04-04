import puppeteer from 'puppeteer';
import { resolve } from 'path';
import BlingScraper from './src/scrapers/BlingScraper.js';
import fexcelToJson from './src/utils/excelToJson.js';

(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 10,
    devtools: true,
    userDataDir: resolve(process.cwd(), 'temp'),
    defaultViewport: { width: 1366, height: 768 },
    // defaultViewport: { width: 1080, height: 1024 },
  });

  await browser.newPage()
  const [whatsapp, bling] = await browser.pages();

  await whatsapp.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2' })
  await whatsapp.bringToFront();
  await whatsapp.waitForSelector('div[title="Caixa de texto de pesquisa"]', { visible: true, timeout: 0 });

  // Restante do seu código aqui
  const blingScraper = new BlingScraper(bling);

  // impondo tentativas de login na plataforma
  let tries = 3;
  let statusLoginBling = false

  while (tries != 0) {
    const blingLogin = await blingScraper.login();
    if (blingLogin.status == 'logado') {
      statusLoginBling = true
      break;
    }
    tries--
    if (tries == 0) {
      console.log('Tentativas de Login na plataforma BLING ESGOTADAS!');
    }
  }

  if (statusLoginBling) {
    const pegaListaClientes = await blingScraper.buscaListaClientes();
    const baseTelefonesParaJson = await fexcelToJson();
    if (baseTelefonesParaJson.status === 'ok') {
      const listaTelefonesAssociados = await blingScraper.associaTelefones(pegaListaClientes.clientes);
      if (listaTelefonesAssociados.status === 'ok') {
        const enviaLinkWpp = await blingScraper.enviaLinkWhatsapp(listaTelefonesAssociados.clientes, browser);
      } else {
        console.log(listaTelefonesAssociados.message);
      }
    } else {
      console.log(baseTelefonesParaJson.message);
    }
  }

})();
