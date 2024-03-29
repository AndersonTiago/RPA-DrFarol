import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

export async function existFile(filePath) {
  return existsSync(filePath)
}
export async function loadCookie(page, filePath) {
  const cookieJson = await readFile(filePath);
  const cookies = JSON.parse(cookieJson);
  await page.setCookie(...cookies);
}
export async function saveCookie(page, filePath) {
  const cookies = await page.cookies();
  const cookieJson = JSON.stringify(cookies, null, 2);
  await writeFile(filePath, cookieJson)
}
