import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function joinPaths(parent, child) {
  const p = parent === "" ? "" : parent;
  const base = p === "" ? "" : p.endsWith("/") ? p.slice(0, -1) : p;
  const seg = child.startsWith("/") ? child : `/${child}`;
  const out = `${base}${seg}` || "/";
  return out.replace(/\/+/g, "/");
}

function extractRoutesFromMainWire(mainWireSource) {
  const lines = mainWireSource.split("\n");
  const stack = [{ path: "" }];
  const routes = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Close tags pop after processing any open tag on the same line (rare here).
    const isClosing = line.startsWith("</Route");

    // Opening Route tags
    if (line.startsWith("<Route")) {
      const isIndex = /\bindex\b/.test(line) && !/\bpath=/.test(line);
      const pathMatch = line.match(/\bpath="([^"]+)"/);
      const isWildcard = pathMatch?.[1] === "*";

      let routePath = null;
      if (pathMatch) {
        const p = pathMatch[1];
        routePath = p.startsWith("/") ? p : joinPaths(stack[stack.length - 1].path || "/", p);
      } else if (isIndex) {
        routePath = stack[stack.length - 1].path || "/";
      }

      if (routePath && !isWildcard) {
        routes.push({ path: routePath, kind: isIndex ? "index" : "path" });
      }

      const isSelfClosing = line.endsWith("/>");
      if (!isSelfClosing && !isIndex && pathMatch) {
        // Only push “container” routes that have children (e.g. "/", "settings")
        stack.push({ path: routePath || stack[stack.length - 1].path });
      }
    }

    if (isClosing) {
      if (stack.length > 1) stack.pop();
    }
  }

  return routes;
}

function extractDocRoutes(docSource) {
  // Pull routes from backticks. We only care about path fragments like `/login`, `/settings/security-history`, etc.
  const matches = [...docSource.matchAll(/`(\/[^`]+)`/g)].map((m) => m[1]);

  // Filter out non-route references
  return matches
    .filter((r) => !r.includes("<route>"))
    .filter((r) => !r.includes("*")) // ignore wildcard/alias notes like `/wire/*`
    .filter((r) => !r.endsWith("/")) // drop `/v2/` base refs
    .filter((r) => r !== "/v2") // drop basename reference
    .filter((r) => !r.includes("→")) // drop arrow rendering edge cases
    .map((r) => r.replace(/^\/v2/, "")) // doc routes are “relative to /v2”
    .map((r) => (r === "" ? "/" : r));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Resolve paths relative to this script so it works no matter where it's run from.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, ".."); // wire2/frontend
const wire2Root = path.resolve(frontendRoot, ".."); // wire2/

const mainWirePath = path.join(frontendRoot, "src", "main-wire.tsx");
const viteWireConfigPath = path.join(frontendRoot, "vite-wire.config.ts");
const routesDocPath = path.join(wire2Root, "docs", "ux", "CRITICAL_FLOWS_AND_ROUTES.md");

const mainWire = read(mainWirePath);
const viteWireConfig = read(viteWireConfigPath);
const routesDoc = read(routesDocPath);

const codeRoutes = extractRoutesFromMainWire(mainWire);
const docRoutes = extractDocRoutes(routesDoc);

const duplicates = Object.entries(
  codeRoutes.reduce((acc, r) => {
    const key = `${r.kind}:${r.path}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})
).filter(([, count]) => count > 1);

assert(
  duplicates.length === 0,
  `Duplicate routes found in main-wire.tsx: ${duplicates.map(([r, c]) => `${r} (${c}x)`).join(", ")}`
);

const codeRouteSet = new Set(codeRoutes.map((r) => r.path));
const missingInCode = [...new Set(docRoutes)].filter((r) => !codeRouteSet.has(r));
assert(missingInCode.length === 0, `Routes documented but not present in router: ${missingInCode.join(", ")}`);

// Base path consistency
const basenameMatch = mainWire.match(/basename="([^"]+)"/);
const viteBaseMatch = viteWireConfig.match(/\bbase:\s*'([^']+)'/);
assert(basenameMatch?.[1], "Could not find BrowserRouter basename in src/main-wire.tsx");
assert(viteBaseMatch?.[1], "Could not find base in vite-wire.config.ts");
const basename = basenameMatch[1];
const viteBase = viteBaseMatch[1].replace(/\/$/, "");
assert(viteBase === `${basename}`, `Base mismatch: BrowserRouter basename="${basename}" but Vite base="${viteBaseMatch[1]}"`);

console.log("[route-regression-check] OK");

