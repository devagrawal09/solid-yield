export default async function (page) {
  await page.waitForTimeout(400);
  const n = Number(await page.evaluate(() => document.querySelector("#ticks")?.textContent ?? "-1"));
  return { ticksAfter400ms: n > 3 ? ">3" : n };
}
