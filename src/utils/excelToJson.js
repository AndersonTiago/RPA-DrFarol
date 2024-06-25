import { openSync, closeSync, readdir, writeFileSync } from 'fs';
import { resolve, extname } from 'path';
import excelToJson from 'convert-excel-to-json';
import delay from './delay.js';

export default async function fexcelToJson() {
  return new Promise(async (res) => {
    const pasta = resolve(process.cwd(), 'src', 'baseTelefones');

    // Lê o conteúdo da pasta
    readdir(pasta, async (err, files) => {
      if (err) {
        console.error('Erro ao ler a pasta:', err);
        return;
      }

      // Filtra apenas arquivos Excel
      const excelFiles = files.filter(file => extname(file).toLowerCase() === '.xlsx' || extname(file).toLowerCase() === '.xls');

      // Verifica se encontrou apenas um arquivo Excel
      if (excelFiles.length === 1) {
        const arquivoExcel = excelFiles[0];
        const result = excelToJson({
          sourceFile: resolve(process.cwd(), 'src', 'baseTelefones', arquivoExcel),
          columnToKey: {
            A: 'nome',
            B: 'celular',
          }
        });

        // Limpa o conteúdo do arquivo JSON
        const jsonFilePath = 'baseTelefones.json';
        const fileDescriptor = openSync(jsonFilePath, 'w');
        closeSync(fileDescriptor);
        await delay(3000);

        // criando json com os telefones a partir do arquivo Excel.
        writeFileSync('baseTelefones.json', JSON.stringify(result, null, 2));

        return res({ status: 'ok' });

      } else if (excelFiles.length > 1) {
        return res({ status: "erro", message: `Mais de um arquivo Excel encontrado na pasta 'baseTelefones', por favor deixar apenas um arquivo, e após reiniciar o robô` });

      } else {
        return res({ status: "erro", message: `Nenhum arquivo Excel encontrado na pasta 'baseTelefones'.` });

      }
    });
  })
}
