
class GeminiService {
  constructor() {
    this.apiKeys = [];
    this.currentKeyIndex = 0;
  }

  setApiKeys(keys) {
    this.apiKeys = keys.filter(k => k && k.trim() !== '');
    this.currentKeyIndex = 0;
  }

  getNextKey() {
    if (this.apiKeys.length === 0) return null;
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  async fetchGemini(apiKey, model, parts) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
            response_mime_type: "application/json"
        }
      })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gemini API error');
    }

    return await response.json();
  }

  async generateMetadata(base64Image, options) {
    const { titleLen, descLen, keywordCount, isSingleKeyword, isPng, isVideo, videoInfo, model = "gemini-1.5-flash" } = options;
    
    // Strip data prefix if exists
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';

    const targetType = isVideo ? 'stock footage video clip' : 'image';
    const videoDetails = isVideo && videoInfo 
      ? `Video Details: Duration: ${videoInfo.formattedDuration}, Resolution: ${videoInfo.resolutionLabel}.` 
      : '';

    const prompt = `Analyze this ${targetType} and provide metadata in JSON format with exactly three keys: "title", "description", and "keywords".
${videoDetails ? `${videoDetails}\n` : ''}
STRICT MANDATORY REQUIREMENTS:
1. Title: MUST be exactly ONE SINGLE, grammatically complete sentence or descriptive phrase${isVideo ? ' describing the action and subject of the video' : ''}.
   - **CRITICAL**: Do NOT end with a period (".").
   - It MUST be exactly between ${titleLen[0]} and ${titleLen[1]} characters long (including spaces). 
   - NEVER end mid-word or mid-phrase. If it's too long, write a conciser phrase. If too short, add visual details. COUNT YOUR CHARACTERS CAREFULLY.
2. Keywords: MUST be an array of EXACTLY ${keywordCount[1]} unique descriptive keywords. ${isSingleKeyword ? 'EACH keyword MUST be ONE SINGLE WORD.' : ''}${isVideo ? ' Include relevant video tags (motion, perspective, scene).' : ''}
3. Description: MUST be between ${descLen[0]} and ${descLen[1]} characters long.
   - MUST be multiple complete sentences. Do not truncate.

CRITICAL CHARACTER COUNT AUDIT:
- If YOUR 'title' is < ${titleLen[0]} or > ${titleLen[1]} characters, it is a FAILURE. Minimum is ${titleLen[0]}, Maximum is ${titleLen[1]}.
- If YOUR 'title' ends with a period, it is a FAILURE.

Guidelines:
- Output: ONLY the JSON object. No markdown, no extra text.
`;

    const parts = [
      { inline_data: { mime_type: mimeType, data: base64Data } },
      { text: prompt }
    ];

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const apiKey = this.getNextKey();
      try {
        const result = await this.fetchGemini(apiKey, model, parts);
        const text = result.candidates[0].content.parts[0].text;
        // Gemini sometimes wraps JSON in markdown blocks
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
      } catch (error) {
        console.error(`Gemini attempt ${attempts + 1} failed:`, error);
        attempts++;
        if (attempts >= maxAttempts) throw error;
      }
    }
  }

  async generatePrompt(base64Image, options) {
    const { model = "gemini-1.5-flash", promptLen = [100, 500], isVideo, videoInfo } = options;
    const base64Data = base64Image.split(',')[1] || base64Image;
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';

    const targetType = isVideo ? 'stock video clip frame' : 'image';
    const videoDetails = isVideo && videoInfo 
      ? `Video Details: Duration: ${videoInfo.formattedDuration}, Resolution: ${videoInfo.resolutionLabel}.` 
      : '';

    const prompt = `Analyze this ${targetType} and provide a highly detailed, creative, and descriptive manual prompt that could be used to recreate this ${isVideo ? 'video footage' : 'image'}.
${videoDetails ? `${videoDetails}\n` : ''}Focus on ${isVideo ? 'camera motion, action pacing, ' : ''}style, lighting, composition, and subject details. 

STRICT REQUIREMENT: The output prompt MUST be between ${promptLen[0]} and ${promptLen[1]} characters long.

Output ONLY the prompt text.`;

    const parts = [
      { inline_data: { mime_type: mimeType, data: base64Data } },
      { text: prompt }
    ];

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const apiKey = this.getNextKey();
      try {
        const result = await this.fetchGemini(apiKey, model, parts);
        return result.candidates[0].content.parts[0].text;
      } catch (error) {
        console.error(`Gemini prompt attempt ${attempts + 1} failed:`, error);
        attempts++;
        if (attempts >= maxAttempts) throw error;
      }
    }
  }
}

export const geminiService = new GeminiService();
export default GeminiService;
