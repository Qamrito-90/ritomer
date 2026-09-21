import { createServer } from "node:http";
import { test as base, expect, type BrowserContext } from "@playwright/test";

const test = base.extend<{ origin: string; contextB: BrowserContext }>({
  origin: [async ({ browser }, use) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      response.setHeader("Cache-Control", "no-store");
      if (url.pathname === "/probe") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ cookie: request.headers.cookie ?? "" }));
        return;
      }
      if (url.pathname === "/set-cookie") {
        const actor = url.searchParams.get("actor");
        if (actor !== "A" && actor !== "B") {
          response.writeHead(400).end();
          return;
        }
        response.setHeader("Set-Cookie", `tooling-smoke=${actor}; HttpOnly; Path=/; SameSite=Lax`);
      } else if (url.pathname !== "/") {
        response.writeHead(404).end();
        return;
      }
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end("<!doctype html><html lang=\"en\"><title>Playwright tooling smoke</title><body>Local test page</body></html>");
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing loopback server address");
      const origin = `http://127.0.0.1:${address.port}`;
      process.stdout.write(`Chromium ${browser.version()} | ${origin}\n`);
      await use(origin);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      expect(server.listening).toBe(false);
      process.stdout.write("Loopback server closed\n");
    }
  }, { timeout: 5_000 }],
  contextB: [async ({ browser }, use) => {
    const context = await browser.newContext({ acceptDownloads: false });
    try {
      await use(context);
    } finally {
      await context.close();
      expect(context.pages()).toHaveLength(0);
      process.stdout.write("Context B closed\n");
    }
  }, { timeout: 5_000 }]
});

test("real cookie round-trip, shared tabs and isolated contexts", async ({ page, context, contextB, origin }) => {
  const pageB = await contextB.newPage();

  await test.step("A receives an HTTP cookie and sends it back; storage survives reload", async () => {
    await page.goto(`${origin}/set-cookie?actor=A`);
    await expect(page).toHaveTitle("Playwright tooling smoke");
    expect(await page.evaluate(async () => (await fetch("/probe")).json())).toEqual({ cookie: "tooling-smoke=A" });
    expect(await page.evaluate(() => document.cookie)).toBe("");
    await page.evaluate(() => localStorage.setItem("tooling-smoke", "A"));
    await page.goto(origin);
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem("tooling-smoke"))).toBe("A");
  });

  const secondPageA = await context.newPage();
  await test.step("two A tabs share cookies and localStorage", async () => {
    await secondPageA.goto(origin);
    expect(await secondPageA.evaluate(async () => (await fetch("/probe")).json())).toEqual({ cookie: "tooling-smoke=A" });
    expect(await secondPageA.evaluate(() => localStorage.getItem("tooling-smoke"))).toBe("A");
    await secondPageA.evaluate(() => localStorage.setItem("tooling-smoke", "A-updated"));
    expect(await page.evaluate(() => localStorage.getItem("tooling-smoke"))).toBe("A-updated");
  });

  await test.step("B starts empty and its values do not change A", async () => {
    await pageB.goto(origin);
    expect(await pageB.evaluate(async () => (await fetch("/probe")).json())).toEqual({ cookie: "" });
    expect(await pageB.evaluate(() => localStorage.getItem("tooling-smoke"))).toBeNull();
    await pageB.goto(`${origin}/set-cookie?actor=B`);
    await pageB.evaluate(() => localStorage.setItem("tooling-smoke", "B"));
    await pageB.goto(origin);
    await pageB.reload();
    expect(await pageB.evaluate(async () => (await fetch("/probe")).json())).toEqual({ cookie: "tooling-smoke=B" });
    expect(await pageB.evaluate(() => localStorage.getItem("tooling-smoke"))).toBe("B");
    expect(await page.evaluate(async () => (await fetch("/probe")).json())).toEqual({ cookie: "tooling-smoke=A" });
    expect(await page.evaluate(() => localStorage.getItem("tooling-smoke"))).toBe("A-updated");
  });

  await test.step("closing A closes both tabs while B remains usable", async () => {
    await context.close();
    expect(page.isClosed()).toBe(true);
    expect(secondPageA.isClosed()).toBe(true);
    expect(pageB.isClosed()).toBe(false);
    await pageB.reload();
    expect(await pageB.evaluate(async () => (await fetch("/probe")).json())).toEqual({ cookie: "tooling-smoke=B" });
    expect(await pageB.evaluate(() => localStorage.getItem("tooling-smoke"))).toBe("B");
  });
});
