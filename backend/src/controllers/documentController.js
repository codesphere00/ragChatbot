const extractTextFromPDF = require("../services/pdfService");
const chunkText = require("../services/chunkService");
const storeChunks = require("../services/vectorService");

const uploadDocument = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No PDF uploaded",
      });
    }

    let totalChunks = 0;

    for (const file of req.files) {
      const text = await extractTextFromPDF(file.path);

      const chunks = chunkText(text);

      totalChunks += chunks.length;

      await storeChunks(
        chunks,
        file.originalname
      );
    }

    res.status(200).json({
      success: true,
      totalChunks,
      totalFiles: req.files.length,
      message: "Stored in Pinecone",
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  uploadDocument,
};