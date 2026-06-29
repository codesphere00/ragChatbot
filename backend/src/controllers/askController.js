const searchChunks = require("../services/searchChunks");
const { GoogleGenAI } = require("@google/genai");
const redisClient = require("../config/redis"); // 1. Import the Redis client

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const askQuestion = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "Question is required",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const cacheKey = `chat_cache:${question.toLowerCase().trim()}`;

    try {
      const cachedAnswer = await redisClient.get(cacheKey);
      if (cachedAnswer) {
        console.log("⚡ Serving response from Redis Cache");
        res.write(`data: ${JSON.stringify({ text: cachedAnswer })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }
    } catch (redisError) {
      console.error("Redis Get Error:", redisError);
    }

    const matches = await searchChunks(question);

    const context = matches
      .map((match) => match.metadata.text)
      .join("\n\n");

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: `
You are an assistant.

Answer ONLY from the provided context.

If the answer is not found in the context, say:
"I couldn't find this information in the uploaded documents."

Context:
${context}

Question:
${question}
      `,
    });

     let fullAnswer = "";
     
    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        fullAnswer += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
   
    if (fullAnswer) {
      try {
        await redisClient.set(cacheKey, fullAnswer, {
          EX: 3600 // Expires in 1 hour
        });
        console.log("💾 Saved response to Redis Cache");
      } catch (redisError) {
        console.error("Redis Set Error:", redisError);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
      res.end();
    }
  }
};
module.exports = askQuestion;