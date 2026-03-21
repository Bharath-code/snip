/**
 * OpenAI Provider Implementation
 *
 * Handles OpenAI API integration with rate limiting,
 * retry logic, and proper error handling
 */

const AIProvider = require('./provider');

class OpenAIProvider extends AIProvider {
  constructor() {
    super();
    this.rateLimit = 30; // requests per minute
    this.requests = [];
  }

  /**
   * Check if we're rate limited
   */
  checkRateLimit() {
    const now = Date.now();
    const minuteAgo = now - 60000;

    // Remove old requests
    this.requests = this.requests.filter(time => time > minuteAgo);

    if (this.requests.length >= this.rateLimit) {
      const waitTime = Math.ceil((this.requests[0] - minuteAgo) / 1000);
      throw new Error(`Rate limit exceeded. Wait ${waitTime} seconds.`);
    }

    this.requests.push(now);
  }

  /**
   * Generate code using OpenAI API
   */
  async generate({ prompt, apiKey, model, maxTokens, language }) {
    this.checkRateLimit();

    // Create structured prompt
    const systemPrompt = `You are a code generation assistant. Generate only the requested code without explanations or markdown formatting. Include template variables where appropriate using {{variable}} syntax.`;

    const userPrompt = language
      ? `Generate a ${language} code snippet for: ${prompt}\n\nRequirements:\n- Language: ${language}\n- Provide only the code, no explanations\n- Format as a complete, runnable snippet\n- Use template variables ({{variable}}) for configurable parts`
      : `Generate a code snippet for: ${prompt}\n\nRequirements:\n- Auto-detect the best language\n- Provide only the code, no explanations\n- Format as a complete, runnable snippet\n- Use template variables ({{variable}}) for configurable parts`;

    // Retry logic
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`HTTP ${response.status}: ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('No content in response');
        }

        // Clean up response - remove markdown code blocks if present
        return content
          .replace(/```[\w]*\n/g, '')
          .replace(/\n```$/g, '')
          .trim();

      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        if (error.message.includes('401') || error.message.includes('Invalid API key')) {
          throw error;
        }
        if (error.message.includes('429')) {
          throw error;
        }

        // For network errors, retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Detect language (not implemented for OpenAI, use separate module)
   */
  detectLanguage(text) {
    // This is handled by the separate detect.js module
    throw new Error('Use detect.js module for language detection');
  }
}

module.exports = new OpenAIProvider();