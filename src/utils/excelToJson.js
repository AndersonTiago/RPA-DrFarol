import { readdir, writeFileSync } from 'fs'
import { resolve, extname } from 'path';
import excelToJson from 'convert-excel-to-json';

export default async function fexcelToJson() {
  return new Promise(async (res) => {
    const pasta = resolve(process.cwd(), 'src', 'baseTelefones');

    // Lê o conteúdo da pasta
    readdir(pasta, (err, files) => {
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
            A: 'id',
            B: 'nome',
            C: 'codigo',
            D: 'situacao',
            E: 'numeroDocumento',
            F: 'telefone',
            G: 'celular',
          }
        });
        console.log(result);

        writeFileSync('baseTelefones.json', JSON.stringify(result))

      } else if (excelFiles.length > 1) {
        console.log('Mais de um arquivo Excel encontrado. Por favor, verifique a pasta.');
      } else {
        console.log('Nenhum arquivo Excel encontrado na pasta.');
      }
    });
  })
}
