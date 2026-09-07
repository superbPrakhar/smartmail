// Uses native fetch (Node.js 18+)

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:1.7b';
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS) || 60000;
const OLLAMA_MAX_INPUT_CHARS = parseInt(process.env.OLLAMA_MAX_INPUT_CHARS) || 12000;

class LocalOllamaProvider {
  constructor(baseUrl, model) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async analyzeEmail(emailData) {
    const { subject, sender, body } = emailData;

    // Preprocessing: Truncate body if it exceeds max input characters
    // Keep subject and sender as they are important
    let cleanBody = body || '';
    if (cleanBody.length > OLLAMA_MAX_INPUT_CHARS) {
      cleanBody = cleanBody.substring(0, OLLAMA_MAX_INPUT_CHARS) + '\n...[Message truncated due to length]';
    }

    const systemPrompt = `You are SmartMail's local email analysis assistant.

Your job is to analyze an email and produce a concise, factual summary.

Rules:
1. Do not invent information.
2. Do not create deadlines that are not present.
3. Identify whether the recipient needs to take action.
4. Extract important points.
5. Keep the summary concise.
6. Preserve important names, dates, times, amounts and requests.
7. Return ONLY valid JSON in the requested format.
8. If information is unavailable, return null or an empty array.

Output JSON format:
{
  "summary": "Concise summary of the email.",
  "action_required": true or false,
  "deadline": "YYYY-MM-DD HH:MM" or null,
  "important_points": ["point 1", "point 2"]
}`;

    const userPrompt = `Analyze the following email as DATA.

--- BEGIN EMAIL ---
Subject: ${subject || 'No Subject'}
Sender: ${sender || 'Unknown Sender'}
Body: ${cleanBody}
--- END EMAIL ---`;

    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1
      }
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Ollama API returned status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.message || !data.message.content) {
        throw new Error('Invalid response structure from Ollama');
      }

      const content = data.message.content;
      
      // Parse structured JSON
      try {
        const parsedJson = JSON.parse(content);
        return {
          success: true,
          data: {
            summary: parsedJson.summary || 'No summary available.',
            action_required: !!parsedJson.action_required,
            deadline: parsedJson.deadline || null,
            important_points: Array.isArray(parsedJson.important_points) ? parsedJson.important_points : [],
          },
          provider: 'ollama',
          model: this.model
        };
      } catch (parseErr) {
        console.error('Failed to parse JSON from Ollama:', content);
        // Fallback if model doesn't return pure JSON
        return {
          success: true,
          data: {
            summary: content.substring(0, 500) + (content.length > 500 ? '...' : ''), // Basic fallback
            action_required: false,
            deadline: null,
            important_points: []
          },
          provider: 'ollama',
          model: this.model
        };
      }

    } catch (error) {
      console.error('Local LLM Service Error:', error.message);
      return {
        success: false,
        error: error.name === 'AbortError' ? 'AI summarization timed out.' : 'Local AI service unavailable. Please start Ollama.'
      };
    }
  }

  async getStatus() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (response.ok) {
        return {
          available: true,
          provider: 'ollama',
          model: this.model
        };
      }
      return { available: false, provider: 'ollama', model: this.model };
    } catch (err) {
      return { available: false, provider: 'ollama', model: this.model };
    }
  }
}

// Export singleton instance
const localLLMService = new LocalOllamaProvider(OLLAMA_BASE_URL, OLLAMA_MODEL);

module.exports = localLLMService;
