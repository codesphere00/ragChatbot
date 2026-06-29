// backend/src/config/redis.js
const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

client.on("error", (err) => console.error("Redis Client Error:", err));
client.on("connect", () => console.log("Redis Connected Successfully"));

// Connect to Redis immediately
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

module.exports = client;