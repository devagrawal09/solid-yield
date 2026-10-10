export default async function (page) {
  await page.waitForTimeout(600);
  return await page.evaluate(() => document.querySelector("#feed")?.textContent ?? null);
}
