import delay from '../utils/delay.js';
import { config } from 'dotenv';
import { existFile, loadCookie, saveCookie } from '../utils/session.js';
import { resolve, join } from 'path';
import baseTelefones from '../../baseTelefones.json' assert {type: 'json'};
import { access, readFile, appendFile, readdir, rename, stat, unlink } from 'fs/promises';

config();
async function getLatestFile(directory) {
  try {
    // Listar arquivos na pasta
    const files = await readdir(directory);
    // Mapear caminhos completos dos arquivos
    const fileStats = await Promise.all(files.map(file => stat(join(directory, file))));
    // Ordenar arquivos por data de modificação (do mais recente para o mais antigo)
    const sortedFiles = files.sort((a, b) => fileStats[files.indexOf(b)].mtime.getTime() - fileStats[files.indexOf(a)].mtime.getTime());
    // Retornar o primeiro arquivo (o mais recente)
    return sortedFiles[0];
  } catch (error) {
    console.error("Erro ao obter o arquivo mais recente:", error);
    throw error; // Lança o erro para ser tratado externamente
  }
}


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
        await delay(500);

        await this.page.waitForSelector('#dialog-picker > div.group-buttons.Grid-inner > div:nth-child(2) > button');
        await (await this.page.$('#dialog-picker > div.group-buttons.Grid-inner > div:nth-child(2) > button')).evaluate((e) => e.click());
        await delay(500);

        const numeroMes = Number(new Date().getMonth()) + 2 // próximo mês        
        await this.page.evaluate((numeroMes) => {
          document.querySelector(`#dialog-picker > div.input-daterange > div:nth-child(1) > div > div.datepicker-months > table > tbody > tr > td > span:nth-child(${numeroMes})`).click()
          return Promise.resolve();
        }, numeroMes);
        await delay(2000);

        // filtrando apenas BOLETOS
        await this.page.waitForSelector(`select[id="idFormaPsq"]`);
        await this.page.select(`select[id="idFormaPsq"]`, '2702517');
        await delay(300);
        await (await this.page.$(`#filter-button-area > button`)).evaluate((e) => e.click());
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
              lista.push({ nome: cliente, celular: '' });
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
            item => item.nome.trim() === listaClientes[i]['nome']);
          if (resultado.length > 0) {
            listaClientes[i]['celular'] = resultado[0]['celular'];
          }
        }

        return resolve({ status: 'ok', clientes: listaClientes });
      } catch (err) {
        console.log(err);
        return resolve({ status: 'erro', message: `FALHA ao associar lista de clientes, ${err.message}}` });
      }
    });
  }

  async enviaLinkWhatsapp(listaClientes, browser, pastaMes) {
    pastaMes = resolve(pastaMes);
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

    try {
      console.log('PERCORRENDO tabela para enviar os links...');
      let index = 0;

      const nomesClientes = listaClientes.map(cliente => cliente.nome);

      for await (const client of listaClientes) {
        let { nome, celular } = client;

        if (lastProcessedName.includes(nome)) {
          console.log(`Nome "${nome}" já foi processado, pulando para o próximo.`);
          index++;
          continue; // Pula para o próximo cliente
        }

        console.log(`----------`);
        console.log(`ENVIANDO boleto para ${nome};`);
        console.log(`CELULAR: ${celular};`);
        console.log(`----------`);

        if (!nomesClientes.includes(nome)) {
          // GRAVAR NA PLANILHA DINAMICAMENTE
          console.log(`--------ATENÇÃO--------- `);
          console.log(`( ${nome} ) NÃO CADASTRADO NA PLANILHA,`);
          console.log(`------------------------ `);
          celular = process.env.CELULAR_CONTATO;
          // index++
          // continue;
        }

        if (!celular || celular == '' || celular == undefined) celular = process.env.CELULAR_CONTATO;

        // Emitindo boleto
        await this.page.evaluate((index) => {
          document.querySelectorAll('div[id="datatable"] > table > tbody > tr')[index]
            .querySelector('td:nth-child(10) > div > ul a > span.fas.fa-barcode')
            .click();
        }, [index]);
        await delay(3000);
        const [, , paginaBoleto] = await browser.pages();
        const clientS = await paginaBoleto.target().createCDPSession()
        await clientS.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: `${pastaMes}`,
        });

        await paginaBoleto.waitForNetworkIdle();
        await delay(5000);
        for (let i = 1; i < 10; i++) {
          if (i != 9) {
            await paginaBoleto.keyboard.press('Tab');
            await delay(100);
          } else {
            await paginaBoleto.keyboard.press('Enter');
            await delay(1000);
          }
        }

        // Renomeando arquivo
        const latestFile = await getLatestFile(pastaMes);
        const novoNome = `${nome.replaceAll('/', '-')}-${Date.now()}.pdf`; // Novo nome desejado
        await rename(join(pastaMes, latestFile), join(pastaMes, novoNome));
        await paginaBoleto.close();

        await delay(1500);
        // Acionando o botão de enviar para o WhatsApp
        await this.page.evaluate((index) => {
          document.querySelectorAll('div[id="datatable"] > table > tbody > tr')[index]
            .querySelector('td:nth-child(10) > div > ul a > span.fab.fa-whatsapp')
            .click();
        }, [index]);
        await delay(5000);

        // Esperando modal abrir e colocando o numero de telefone
        await this.page.waitForSelector('div[role="dialog"]', { timeout: 60000 });
        await this.page.evaluate((celular) => {
          console.log("celular", celular);
          celular = "(16) 99243-6784";
          document.querySelector('div[role="dialog"] > div:nth-child(2)>div > div > input').value = "";
          document.querySelector('div[role="dialog"] > div:nth-child(2)>div > div > input').value = celular;
          return Promise.resolve();
        }, celular);
        await delay(500);

        await this.page.evaluate(() => Promise.resolve(document.querySelector('div[role="dialog"] > div:nth-child(3) > div > button').click()));
        await delay(5000);

        const [, , wpp] = await browser.pages();

        try {
          await wpp.waitForSelector('div[title="Digite uma mensagem"]', { timeout: 80000 });
          await delay(3000);

          await (await wpp.$('button[aria-label="Enviar"]')).evaluate((e) => e.click());
          await delay(1000);

          await wpp.type('div[title="Digite uma mensagem"]', `${nome}, estamos entrando em contato para lembrá-lo(a) sobre o vencimento do seu boleto. Segue o link do seu boleto.  Sua pontualidade é fundamental para nós.`)
          await delay(300);

          await (await wpp.$('button[aria-label="Enviar"]')).evaluate((e) => e.click());
          await delay(2000);
        } catch (err) {
          console.log('ATENÇÃO!!!');
          console.log(`Número de telefone: '${celular}' do cliente: '${nome}' é inválido, por favor atualizar na base de dados com um número que contenha whatsapp.`);
          await delay(3000);
        }

        await wpp.close();
        await delay(1500);

        // Registra o nome no arquivo de texto
        await appendFile(txtFilePath, `${nome}\n`);

        index++; // Incrementa o índice para avançar para o próximo cliente
      }

      await unlink(txtFilePath);

      return { status: 'ok', message: 'Boletos enviados com sucesso. Até breve =D' }
    } catch (err) {
      console.log(err);
      return { status: 'erro', message: 'FALHA ao associar lista de clientes' }
    }

  }
}

export default Scraper;
