/**
 * AI Provider Interface
 *
 * Defines the common interface for AI providers
 * Currently supports OpenAI, but designed for extensibility
 */

class AIProvider {
  /**
   * Generate a code snippet
   * @param {Object} params - Generation parameters
   * @param {string} params.prompt - The user prompt
   * @param {string} params.apiKey - API key
   * @param {string} params.model - Model to use
   * @param {number} params.maxTokens - Maximum tokens to generate
   * @param {string} params.language - Target language (optional)
   * @returns {Promise<string>} - Generated code
   */
  async generate(params) {
    throw new Error('generate method must be implemented');
  }

  /**
   * Detect programming language from text
   * @param {string} text - Text to analyze
   * @returns {string} - Detected language
   */
  detectLanguage(text) {
    throw new Error('detectLanguage method must be implemented');
  }
}

module.exports = AIProvider;