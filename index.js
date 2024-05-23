import puppeteer from 'puppeteer';
import { resolve } from 'path';
import BlingScraper from './src/scrapers/BlingScraper.js';
import fexcelToJson from './src/utils/excelToJson.js';
import delay from './src/utils/delay.js';
import { existsSync, mkdirSync } from 'fs';
import { TentativasLoginExcedidas } from './src/validations/tentativas-login-excedidas.js';

(async () => {
  const agora = new Date();
  const ano = agora.getFullYear().toString();
  const mes = (agora.getMonth() + 1).toString().padStart(2, '0');

  const pastaAno = resolve(process.cwd(), 'download', ano);
  const pastaMes = resolve(process.cwd(), 'download', ano, mes);

  // Verifique se as pastas existem, se não, crie-as
  if (!existsSync(pastaAno)) {
    mkdirSync(pastaAno, { recursive: true });
  }
  if (!existsSync(pastaMes)) {
    mkdirSync(pastaMes, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 10,
    userDataDir: resolve(process.cwd(), 'temp'),
    defaultViewport: { width: 1366, height: 768 },
  });

  await browser.newPage()
  const [whatsapp, bling] = await browser.pages();

  console.log('...RPA start...');
  // await delay(3000);
  console.log('........... AVISO ..............');
  console.log('Para total funcionamento do RPA, a base de telefones deve estar atualizada');
  console.log('e com números que contenham whatsapp, caso contrário um alerta será emitido');
  console.log('informando o número inválido e o cliente.');
  console.log('Caso aconteça, solicito a troca do número do cliente em questão na base.');
  console.log('................................');
  // await delay(10000);
  console.log('Primeramente sincronize seu whatsapp na página que irá aparecer.');
  // await delay(1000)
  await whatsapp.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2' })
  await whatsapp.bringToFront();

  let authenticated = false;

  while (!authenticated) {
    try {
      await whatsapp.waitForSelector('div[aria-label="Caixa de texto de pesquisa"]', { visible: true, timeout: 0 });
      authenticated = true;
    } catch (error) {
      console.log("Ainda não autenticado. Tentando novamente...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  await delay(300);
  const blingScraper = new BlingScraper(bling);

  let tries = 3;
  while (tries != 0) {
    const blingLogin = await blingScraper.login();
    if (blingLogin.status == 'logado') {
      break;
    }
    tries--
    if (tries == 0) {
      throw new Error(new TentativasLoginExcedidas());
    }
  }

  const pegaListaClientes = await blingScraper.buscaListaClientes();
  const baseTelefonesParaJson = await fexcelToJson();
  if (baseTelefonesParaJson.status === 'ok') {
    const listaTelefonesAssociados = await blingScraper.associaTelefones(pegaListaClientes.clientes);
    if (listaTelefonesAssociados.status === 'ok') {
      const enviaLinkWpp = await blingScraper.enviaLinkWhatsapp(listaTelefonesAssociados.clientes, browser, pastaMes);
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


})();
