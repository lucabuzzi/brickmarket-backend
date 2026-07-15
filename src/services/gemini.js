/**
 * gemini.js — Intelligence Layer for Multilingual Localization
 * Uses Gemini 3 Flash to instantly translate LEGO set names and metadata.
 */

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Translates a LEGO set name into Italian, French, and German.
 * Returns an object with the translations.
 */
async function translateSetName(englishName) {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini] GEMINI_API_KEY not set — using English for all languages.');
    return {
      en: englishName,
      it: englishName,
      fr: englishName,
      de: englishName
    };
  }

  const prompt = `
    You are a professional LEGO catalog translator. 
    Translate the following LEGO set name from English into Italian, French, and German.
    Keep the set name accurate and natural for collectors in those countries.
    Return ONLY a JSON object with keys "it", "fr", "de".
    Set Name: "${englishName}"
  `;

  try {
    const response = await axios.post(GEMINI_URL, {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    }, {
      timeout: 3000 // Tight timeout for performance
    });

    const content = response.data.candidates[0].content.parts[0].text;
    const translations = JSON.parse(content);
    
    return {
      en: englishName,
      ...translations
    };
  } catch (err) {
    console.error('[Gemini] Translation error:', err.message);
    return {
      en: englishName,
      it: englishName,
      fr: englishName,
      de: englishName
    };
  }
}

module.exports = { translateSetName };
