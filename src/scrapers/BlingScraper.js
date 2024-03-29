import delay from '../utils/delay.js';
import { config } from 'dotenv';
import { existFile, loadCookie, saveCookie } from '../utils/session.js';
import { resolve } from 'path';
config();

class Scraper {
  sessionPath = resolve(process.cwd(), "src", "sessions", "bling.json");

  constructor(page) {
    this.page = page;
  }
  async login() {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('Efetuando login no BLING...');
        await this.page.bringToFront();
        // verificando arquivos de sessão
        const verifyFile = await existFile(this.sessionPath);
        if (verifyFile) {
          await loadCookie(this.page, this.sessionPath);
        };

        await this.page.goto('https://www.bling.com.br/contas.receber.php', { waitUntil: 'networkidle2' });

        if (!this.page.url().toLowerCase().includes('login') && this.page.url().toLowerCase().includes('contas.receber')) {
          console.log('Login Bling efetuado com sucesso!');
          return resolve({ status: 'logado' });
        }

        await this.page.goto('https://www.bling.com.br/', { waitUntil: 'networkidle2' });
        const credenciais = {
          username: '',
          password: ''
        }
        // Definindo usuário que será logado
        if (process.env.AMBIENTE.toLowerCase() == 'production') {

          credenciais.username = process.env.USERNAME_BLING
          credenciais.password = process.env.PASSWORD_BLING
        } else {
          credenciais.username = process.env.USERNAME_BLING_TESTE
          credenciais.password = process.env.PASSWORD_BLING_TESTE
        }

        // Efetuando login
        await this.page.waitForSelector('input[id="username"]');
        await this.page.evaluate((credenciais) => {
          document.querySelector('input[id="username"]').value = credenciais.username;
          document.querySelector('input[id="senha"]').value = credenciais.password;
          return Promise.resolve();
        }, credenciais);
        await delay(300);
        await this.page.evaluate(() => {
          document.querySelector('button[type="submit"]').click();
          return Promise.resolve();
        });
        await delay(10000);

        await saveCookie(this.page, this.sessionPath);

        await this.page.waitForSelector('#menu-novo > ul:nth-child(1) > li:nth-child(5) > ul > li:nth-child(3) > a', { timeout: 60000 });
        await this.page.evaluate(() => {
          document.querySelector('#menu-novo > ul:nth-child(1) > li:nth-child(5) > ul > li:nth-child(3) > a').click();
          return Promise.resolve();
        })

        console.log('Login Bling efetuado com sucesso!');
        return resolve({ status: 'logado' });
      } catch (err) {
        console.log('FALHA ao tentar efetuar login Bling', err.message);
        return resolve({ status: 'falha ao tentar efetuar login' });
      }

    })
  }

  // async sharedWhatsapp() {
  //   return new Promise(async (resolve) => {
  //     try {
  //       await this.page.bringToFront();

  //       await this.page.waitForSelector("#top-level-buttons-computed > yt-button-view-model > button-view-model > button");
  //       await this.page.click("#top-level-buttons-computed > yt-button-view-model > button-view-model > button");

  //       await this.page.waitForSelector('button[title="WhatsApp"]');
  //       await this.page.click('button[title="WhatsApp"]');

  //       await delay(3000);

  //       return resolve({
  //         sucesso: true,
  //       })
  //     } catch (err) {
  //       console.error(err);
  //       return resolve({
  //         sucesso: false,
  //         erro: err.message
  //       })
  //     }
  //   })
  // }
  // async sendMessage(page) {
  //   return new Promise(async (resolve) => {
  //     try {
  //       await page.waitForSelector('a[title="Compartilhe no WhatsApp"]');
  //       await page.click('a[title="Compartilhe no WhatsApp"]');

  //       await page.waitForSelector('section > div > div > div > div div:nth-child(3) > h4:nth-child(2) > a');
  //       await page.evaluate(() => {
  //         document.querySelector('section > div > div > div > div div:nth-child(3) > h4:nth-child(2) > a').click()
  //         return Promise.resolve()
  //       })

  //       await page.waitForSelector('div[title="Caixa de texto de pesquisa"]')
  //       await page.type('div[title="Caixa de texto de pesquisa"]', 'Alex')

  //       await page.waitForSelector('div[role="checkbox"]')
  //       await page.evaluate(() => {
  //         document.querySelector('div[role="checkbox"]').click()
  //         return Promise.resolve()
  //       })

  //       await page.waitForSelector('div[data-animate-btn="true"] > div')
  //       await page.evaluate(() => {
  //         document.querySelector('div[data-animate-btn="true"] > div').click()
  //         return Promise.resolve()
  //       })

  //       await page.waitForSelector('div[title="Digite uma mensagem"]');
  //       await page.keyboard.press('Enter');
  //       return resolve({
  //         sucesso: true
  //       })
  //     } catch (err) {
  //       return resolve({
  //         sucesso: false,
  //         erro: err.message
  //       })
  //     }
  //   })
  // }
}

export default Scraper;
