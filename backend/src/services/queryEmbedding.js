// services/queryEmbedding.js
const generateEmbedding = require("./embeddingService");

const queryEmbedding = async (query) => {
  return await generateEmbedding(query);
};

module.exports = queryEmbedding;