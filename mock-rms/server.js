const http = require("http");

const PORT = 3001;

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const ts = new Date().toISOString();
        console.log(`[${ts}] Webhook received:`);
        console.log(JSON.stringify(payload, null, 2));
        console.log("---");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", receivedAt: ts }));
      } catch (err) {
        console.error("Failed to parse webhook payload:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", message: "Invalid JSON" }));
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "not_found" }));
  }
});

server.listen(PORT, () => {
  console.log(`✓ Mock RMS listening on http://localhost:${PORT}/webhook`);
  console.log("  Waiting for webhook deliveries...");
});
