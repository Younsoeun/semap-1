import puppeteer from "puppeteer-core";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = process.argv[2];
const b = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle"],
});
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const errors = [];
p.on("pageerror", (e) => errors.push(e.message));

async function shot(hash, waitFor, name) {
  await p.goto("http://localhost:8777/" + hash, { waitUntil: "networkidle0" });
  if (waitFor) await p.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  await p.screenshot({ path: `${OUT}/mob-${name}.png` });
}

await shot("#/", "#globe canvas", "globe");
await shot("#/city/portugal/lisboa", ".attraction-card", "city");
await shot("#/culture/portugal", ".culture-section", "culture");

// 가로 스크롤(오버플로) 검사
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log("horizontal overflow:", overflow);
console.log("page errors:", errors.length, errors.slice(0, 5));
await b.close();
