export default async function (page) {
  await page.waitForTimeout(300);
  return await page.evaluate(() => document.querySelector("#root")?.innerHTML ?? null);
}
