const { Configuration, OpenAIApi } = require('openai');

class AIService {
  constructor() {
    this.configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.openai = new OpenAIApi(this.configuration);
  }

  // Generate component using AI
  async generateComponent({ name, type, content, projectContext }) {
    try {
      const prompt = this.buildComponentPrompt({
        name,
        type,
        content,
        projectContext
      });

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer assistant specializing in creating high-quality, accessible, and responsive web components.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const generatedContent = this.parseAIResponse(response.data.choices[0].message.content);

      return {
        content: generatedContent,
        prompt,
        model: 'gpt-4',
        confidence: this.calculateConfidence(response.data)
      };
    } catch (error) {
      console.error('AI component generation error:', error);
      throw new Error('Failed to generate component using AI');
    }
  }

  // Get suggestions for component improvement
  async getComponentSuggestions(component) {
    try {
      const prompt = this.buildSuggestionsPrompt(component);

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer focusing on best practices, accessibility, performance, and user experience.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return this.parseSuggestions(response.data.choices[0].message.content);
    } catch (error) {
      console.error('AI suggestions error:', error);
      throw new Error('Failed to get AI suggestions');
    }
  }

  // Get project-level suggestions
  async getProjectSuggestions({ name, description, metadata }) {
    try {
      const prompt = this.buildProjectPrompt({ name, description, metadata });

      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert project architect focusing on structure, scalability, and best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return this.parseProjectSuggestions(response.data.choices[0].message.content);
    } catch (error) {
      console.error('AI project suggestions error:', error);
      throw new Error('Failed to get project suggestions');
    }
  }

  // Helper methods
  buildComponentPrompt({ name, type, content, projectContext }) {
    return `
      Create a web component with the following specifications:
      Name: ${name}
      Type: ${type}
      Project Context: ${JSON.stringify(projectContext)}
      Content Requirements: ${JSON.stringify(content)}

      Please provide:
      1. HTML structure
      2. CSS styles (focusing on responsiveness and accessibility)
      3. JavaScript functionality (if needed)
      4. Any necessary ARIA attributes
      5. Optimization suggestions
    `;
  }

  buildSuggestionsPrompt(component) {
    return `
      Analyze this web component and provide improvement suggestions:
      Component: ${JSON.stringify({
        name: component.name,
        type: component.type,
        content: component.content,
        styles: component.styles
      })}

      Focus on:
      1. Accessibility improvements
      2. Performance optimizations
      3. Best practices
      4. Responsive design
      5. User experience
    `;
  }

  buildProjectPrompt({ name, description, metadata }) {
    return `
      Analyze this project and provide architectural suggestions:
      Project: ${JSON.stringify({
        name,
        description,
        metadata
      })}

      Focus on:
      1. Component organization
      2. State management
      3. Performance considerations
      4. Scalability
      5. Best practices
    `;
  }

  parseAIResponse(response) {
    try {
      // Extract and structure the AI response
      const sections = response.split('\n\n');
      return {
        html: this.extractSection(sections, 'HTML'),
        css: this.extractSection(sections, 'CSS'),
        javascript: this.extractSection(sections, 'JavaScript')
      };
    } catch (error) {
      console.error('AI response parsing error:', error);
      return null;
    }
  }

  parseSuggestions(response) {
    try {
      // Parse and categorize suggestions
      const suggestions = response.split('\n')
        .filter(line => line.trim())
        .map(suggestion => {
          const [type, ...details] = suggestion.split(':');
          return {
            type: type.trim(),
            improvement: details.join(':').trim(),
            confidence: this.calculateConfidence({ content: suggestion })
          };
        });

      return suggestions;
    } catch (error) {
      console.error('Suggestions parsing error:', error);
      return [];
    }
  }

  parseProjectSuggestions(response) {
    try {
      // Parse and categorize project suggestions
      const categories = ['Structure', 'Performance', 'Scalability', 'Best Practices'];
      const suggestions = {};

      categories.forEach(category => {
        suggestions[category.toLowerCase()] = this.extractSection(response.split('\n\n'), category);
      });

      return suggestions;
    } catch (error) {
      console.error('Project suggestions parsing error:', error);
      return {};
    }
  }

  extractSection(sections, sectionName) {
    const section = sections.find(s => s.includes(`${sectionName}:`));
    return section ? section.split(`${sectionName}:`)[1].trim() : '';
  }

  calculateConfidence(response) {
    // Implement confidence calculation based on various factors
    const factors = {
      responseLength: response.content?.length || 0,
      keywordPresence: this.countKeywords(response.content || ''),
      structureQuality: this.assessStructure(response.content || '')
    };

    // Weight and combine factors
    const confidence = (
      (factors.responseLength > 100 ? 0.3 : 0.1) +
      (factors.keywordPresence > 5 ? 0.4 : 0.2) +
      (factors.structureQuality > 0.5 ? 0.3 : 0.1)
    );

    return Math.min(confidence, 1);
  }

  countKeywords(text) {
    const keywords = ['accessibility', 'responsive', 'performance', 'best practice', 'optimization'];
    return keywords.reduce((count, keyword) => 
      count + (text.toLowerCase().match(new RegExp(keyword, 'g')) || []).length, 0
    );
  }

  assessStructure(text) {
    const hasStructure = text.includes('\n') && text.includes(':');
    const hasCodeBlocks = text.includes('```');
    const hasCategories = text.includes('1.') || text.includes('•');

    return (hasStructure ? 0.4 : 0) +
           (hasCodeBlocks ? 0.3 : 0) +
           (hasCategories ? 0.3 : 0);
  }
}

module.exports = {
  aiService: new AIService()
};
