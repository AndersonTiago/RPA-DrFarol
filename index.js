import puppeteer from 'puppeteer';
import { resolve } from 'path';
import BlingScraper from './src/scrapers/BlingScraper.js';
import fexcelToJson from './src/utils/excelToJson.js';
import delay from './src/utils/delay.js';

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

  console.log('...RPA start...');
  await delay(3000);
  console.log('........... AVISO ..............');
  console.log('Para total funcionamento do RPA, a base de telefones deve estar atualizada');
  console.log('e com números que contenham whatsapp, caso contrário um alerta será emitido');
  console.log('informando o número inválido e o cliente.');
  console.log('Caso aconteça, solicito a troca do número do cliente em questão na base.');
  console.log('................................');
  await delay(10000);
  console.log('Primeramente sincronize seu whatsapp na página que irá aparecer.');
  await delay(1000)
  await whatsapp.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2' })
  await whatsapp.bringToFront();
  await whatsapp.waitForSelector('div[title="Caixa de texto de pesquisa"]', { visible: true, timeout: 0 });

  await delay(300);
  console.log('Meus parabéns você concluiu o primeiro passo =D');
  await delay(300);
  const blingScraper = new BlingScraper(bling);

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
        if (enviaLinkWpp.status == 'ok') {
          console.log(enviaLinkWpp.message);
          await browser.close();
        }
      } else {
        console.log(listaTelefonesAssociados.message);
      }
    } else {
      console.log(baseTelefonesParaJson.message);
    }
  } else {
    console.log('Não foi possível efetuar login no BLING =(');
    await browser.close();
  }

})();
