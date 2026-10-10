export default async function (page) {
  const text = () => page.evaluate(() => document.querySelector("#footer")?.textContent ?? null);
  await page.waitForTimeout(300);
  const before = await text();
  await page.click("#bump", { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { before, after: await text() };
}
