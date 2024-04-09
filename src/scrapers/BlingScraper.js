import delay from '../utils/delay.js';
import { config } from 'dotenv';
import { existFile, loadCookie, saveCookie } from '../utils/session.js';
import { resolve } from 'path';
import baseTelefones from '../../baseTelefones.json' assert {type: 'json'};
import { access, readFile, appendFile, unlink } from 'fs/promises';

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

        await delay(8000);
        console.log('Login Bling efetuado com sucesso!');
        return resolve({ status: 'logado' });
      } catch (err) {
        console.log('FALHA ao tentar efetuar login Bling', err.message);
        return resolve({ status: 'falha ao tentar efetuar login' });
      }

    })
  }

  async buscaListaClientes() {
    return new Promise(async (resolve) => {
      try {
        console.log('BUSCANDO lista de clientes');
        await this.page.waitForSelector('button[id="dtButton"]', { timeout: 60000 });
        await (await this.page.$('button[id="dtButton"]')).evaluate((e) => e.click());
        await delay(1000);

        await this.page.waitForSelector("#dialog-picker > div.input-daterange > ul > li:nth-child(6)");
        await (await this.page.$("#dialog-picker > div.input-daterange > ul > li:nth-child(6)")).evaluate((e) => e.click());
        await delay(1000);

        await this.page.waitForSelector('#dialog-picker > div.group-buttons.Grid-inner > div:nth-child(2) > button');
        await (await this.page.$('#dialog-picker > div.group-buttons.Grid-inner > div:nth-child(2) > button')).evaluate((e) => e.click());
        await delay(1000);

        await this.page.keyboard.press('Enter');
        await delay(5000);

        const listaClientes = await this.page.evaluate(() => {
          const qtdLinhas = document.querySelector('div[id="datatable"] > table > tbody').childElementCount;
          const lista = [];
          for (let i = 0; i < qtdLinhas; i++) {
            try {
              const cliente = document.querySelectorAll('div[id="datatable"] > table > tbody>tr')[i].querySelector('td:nth-child(2)')
                .textContent
                .toUpperCase()
                .trim()
                .replace('CLIENTE:', '')
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/\(\s*([^)]+?)\s*\)/g, '($1)');
              lista.push({ nome: cliente, telefone: '', celular: '' });
            } catch (err) { }
          }

          return Promise.resolve(lista);
        })

        return resolve({ status: 'ok', clientes: listaClientes });

      } catch (err) {
        console.log('FALHA ao obter lista de clientes', err.message);
        return resolve({ status: 'erro', clientes: null });
      }
    })
  }

  async associaTelefones(listaClientes) {
    return new Promise(async (resolve) => {
      try {
        console.log('ASSOCIANDO lista de cliente com os telefones da base Excel');
        await delay(8000);
        for (let i = 0; i < listaClientes.length; i++) {
          const resultado = baseTelefones.Franqueados.filter(
            item => item.nome
              .trim()
              .replace(/\s+/g, ' ')
              .replace(/\(\s*([^)]+?)\s*\)/g, '($1)') === listaClientes[i]['nome']);
          if (resultado.length > 0) {
            listaClientes[i]['telefone'] = resultado[0]['telefone'];
            listaClientes[i]['celular'] = resultado[0]['celular'];
          }
        }

        return resolve({ status: 'ok', clientes: listaClientes });
      } catch (err) {
        return resolve({ status: 'erro', message: `FALHA ao associar lista de clientes, ${err.message}}` });
      }
    });
  }

  async enviaLinkWhatsapp(listaClientes, browser) {
    const txtFilePath = 'nomes_processados.txt';
    let lastProcessedName = '';

    // Verifica se o arquivo JSON já existe
    try {
      await access(txtFilePath);
      const txtContent = await readFile(txtFilePath, 'utf8');
      lastProcessedName = txtContent.trim();
    } catch (error) {
      console.log('Arquivo de texto não existe ou não pode ser lido:', error.message);
    }

    // Retorna uma promessa
    return new Promise(async (resolve) => {
      try {
        console.log('PERCORRENDO tabela para enviar os links...');
        let index = 0;

        for await (const client of listaClientes) {
          const { nome, celular } = client;

          if (lastProcessedName.includes(nome)) {
            console.log(`Nome "${nome}" já foi processado, pulando para o próximo.`);
            continue; // Pula para o próximo cliente
          }

          // Seu código para enviar a mensagem via WhatsApp
          if (!celular || celular === '') celular = process.env.CELULAR_CONTATO; // Verifica e atribui o celular

          // Acionando o botão de enviar para o WhatsApp
          await this.page.evaluate((index) => {
            document.querySelectorAll('div[id="datatable"] > table > tbody > tr')[index]
              .querySelector('td:nth-child(10) > div > ul a > span.fab.fa-whatsapp')
              .click();
          }, [index]);
          await delay(500);

          // Esperando modal abrir e colocando o numero de telefone
          await this.page.waitForSelector('div[role="dialog"]', { timeout: 60000 });
          await this.page.evaluate((celular) => {
            console.log("celular", celular);
            celular = "(16) 99243-6784"
            document.querySelector('div[role="dialog"] > div:nth-child(2)>div > div > input').value = "";
            document.querySelector('div[role="dialog"] > div:nth-child(2)>div > div > input').value = celular;
            return Promise.resolve();
          }, celular);
          await delay(500);

          await this.page.evaluate(() => Promise.resolve(document.querySelector('div[role="dialog"] > div:nth-child(3) > div > button').click()));
          await delay(5000);

          const [, , wpp] = await browser.pages();
          await wpp.waitForSelector('div[title="Digite uma mensagem"]', { timeout: 80000 });
          await delay(3000);

          await (await wpp.$('button[aria-label="Enviar"]')).evaluate((e) => e.click());
          await delay(2000);

          await wpp.close();
          await delay(1500);

          // Registra o nome no arquivo de texto
          await appendFile(txtFilePath, `${nome}\n`);

          index++; // Incrementa o índice para avançar para o próximo cliente
        }

        await unlink(txtFilePath);

        return resolve({ status: 'ok', message: 'Boletos enviados com sucesso. Até breve =D' }); // Retorna uma promessa resolvida
      } catch (err) {
        return resolve({ status: 'erro', message: 'FALHA ao associar lista de clientes' }); // Retorna uma promessa resolvida com erro
      }
    });
  }
}

export default Scraper;
