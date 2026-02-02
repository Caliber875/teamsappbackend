const io = require("socket.io-client");

const SOCKET_URL = "http://localhost:3001";

console.log(`Testing connection to: ${SOCKET_URL}`);

const socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"], // Allow polling first
    reconnectionAttempts: 3,
});

socket.on("connect", () => {
    console.log("✅ Connected! Socket ID:", socket.id);
    console.log("Transport:", socket.io.engine.transport.name);

    // Test emission
    socket.emit("ping", "hello");
});

socket.on("connect_error", (err) => {
    console.error("❌ Connection Error:", err.message);
    // Log specific details if available
    if (err.description) console.error("Description:", err.description);
    if (err.context) console.error("Context:", err.context);
});

socket.on("disconnect", (reason) => {
    console.log("⚠️ Disconnected:", reason);
});

// Force exit after 10s
setTimeout(() => {
    console.log("Timeout reached. Exiting.");
    if (socket.connected) socket.disconnect();
    process.exit(0);
}, 10000);
