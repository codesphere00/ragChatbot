// services/searchChunks.js
const index = require("../config/pinecone");
const queryEmbedding = require("./queryEmbedding");

const searchChunks = async (question) => {
  const embedding = await queryEmbedding(question);

  const results = await index.query({
    vector: embedding,
    topK: 5,
    includeMetadata: true,
  });

  return results.matches;
};

module.exports = searchChunks;