const index = require("../config/pinecone");
const generateEmbedding = require("./embeddingService");

const storeChunks = async (chunks , filename) => {
  const vectors = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(
      chunks[i]
    );

    vectors.push({
      id: `${filename.replace(".pdf", "")}-${i}`,
      values: embedding,
      metadata: {
         text: chunks[i],
         source: filename,
         chunkNumber: i,
      },
    });
  }

 await index.upsert({
    records: vectors,
  });

};

module.exports = storeChunks;