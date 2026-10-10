export default async function (page) {
  await page.waitForSelector("#send");
  await page.click("#send");
  await page.waitForTimeout(100);
  const during = await page.evaluate(() => ({ label: document.querySelector("#send").textContent, draft: document.querySelector("#draft").value, disabled: document.querySelector("#draft").disabled }));
  await page.click("#send"); // second click while the first is pending
  await page.waitForTimeout(1500);
  const sent = await page.textContent("#sent");
  return { during, sentAfterTwoClicks: sent };
}
