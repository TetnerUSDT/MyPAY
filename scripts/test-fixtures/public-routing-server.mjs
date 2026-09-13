import http from "node:http";

const mode = process.argv[2] ?? "pass";
const supportedModes = new Set([
  "pass",
  "api-unreachable",
  "spa-fallback",
  "upload-content-type",
]);

if (!supportedModes.has(mode)) {
  console.error(
    `Unknown fixture mode "${mode}". Expected one of: ${[
      ...supportedModes,
    ].join(", ")}`,
  );
  process.exit(1);
}

const frontendHtml = "<!doctype html><html><body><div id=\"root\"></div></body></html>";
const clientRoute = "/dashboard";
const uploadPath = "/media/custom-start-bg.webp";

const server = http.createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

  if (path === "/healthz" || path === "/api/healthz") {
    if (mode === "api-unreachable" && path === "/api/healthz") {
      request.socket.destroy();
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (path === uploadPath) {
    if (mode === "upload-content-type") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(frontendHtml);
      return;
    }

    response.writeHead(200, { "content-type": "image/webp" });
    response.end("RIFFfixtureWEBP");
    return;
  }

  if (path === clientRoute) {
    if (mode === "spa-fallback") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<!doctype html><html><body>wrong upstream</body></html>");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end(frontendHtml);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    console.error("Fixture server did not expose a TCP port.");
    process.exit(1);
  }

  console.log(`READY ${address.port}`);
});