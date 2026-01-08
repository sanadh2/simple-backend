import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface AITaggingResult {
  tags: string[];
  summary?: string | undefined;
}

interface OllamaMessage {
  role: string;
  content: string;
  thinking?: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
}

export class OpenAIService {
  static async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${env.OLLAMA_API_URL}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private static async callOllama(messages: Array<{ role: string; content: string }>, options?: { format?: 'json' }): Promise<string> {
    try {
      const response = await fetch(`${env.OLLAMA_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: options?.format === 'json' ? 200 : 100,
          },
          format: options?.format === 'json' ? 'json' : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as OllamaResponse;
      
      logger.debug('Ollama response received', { 
        hasData: !!data,
        hasMessage: !!data?.message,
        hasContent: !!data?.message?.content,
        hasThinking: !!data?.message?.thinking,
        done: data?.done 
      });
      
      if (!data || !data.message) {
        logger.error('Invalid Ollama response format', { 
          data,
          responseKeys: data ? Object.keys(data) : [],
          messageKeys: data?.message ? Object.keys(data.message) : []
        });
        throw new Error(`Invalid response format from Ollama. Expected message, got: ${JSON.stringify(data)}`);
      }

      const content = data.message.content || data.message.thinking || '';
      
      if (!content) {
        logger.error('Empty content from Ollama', { 
          message: data.message,
          hasContent: !!data.message.content,
          hasThinking: !!data.message.thinking
        });
        throw new Error('Empty response from Ollama');
      }

      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ollama API call failed', { 
        url: `${env.OLLAMA_API_URL}/api/chat`,
        model: env.OLLAMA_MODEL,
        error: errorMessage 
      });
      throw error;
    }
  }

  static async generateTags(url: string, title: string, description?: string): Promise<AITaggingResult> {
    try {
      const content = `
URL: ${url}
Title: ${title}
${description ? `Description: ${description}` : ''}

Based on the above information, generate 3-5 relevant tags/categories for this bookmark.
The tags should be:
- Short (1-2 words)
- Relevant to the content
- Useful for categorization
- General enough to group similar bookmarks

Also provide a brief 1-sentence summary if no description is provided.

Respond in JSON format:
{
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "Brief summary here"
}
`;

      const response = await this.callOllama(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that categorizes bookmarks and generates relevant tags. Always respond with ONLY valid JSON, no additional text or explanation.',
          },
          {
            role: 'user',
            content,
          },
        ],
        { format: 'json' }
      );

      if (!response) {
        throw new Error('No response from Ollama');
      }

      let cleanedResponse = response.trim();
      
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      let result: AITaggingResult;
      try {
        result = JSON.parse(cleanedResponse) as AITaggingResult;
      } catch (parseError) {
        logger.warn('Failed to parse JSON from response', { 
          response: cleanedResponse.substring(0, 200),
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
        
        const tagsMatch = cleanedResponse.match(/tags.*?\[(.*?)\]/is);
        const summaryMatch = cleanedResponse.match(/summary.*?["'](.*?)["']/is);
        
        if (tagsMatch && tagsMatch[1]) {
          const tagsStr = tagsMatch[1];
          const tags = tagsStr.split(',').map(t => t.trim().replace(/["']/g, '')).filter(Boolean);
          result = {
            tags: tags.length > 0 ? tags : ['uncategorized'],
            summary: summaryMatch && summaryMatch[1] ? summaryMatch[1] : description || undefined,
          };
        } else {
          throw new Error('Could not extract tags from response');
        }
      }
      
      if (!result.tags || !Array.isArray(result.tags) || result.tags.length === 0) {
        throw new Error('Invalid response format: no tags found');
      }
      
      logger.info('AI tags generated', { url, tags: result.tags, model: env.OLLAMA_MODEL });
      
      return result;
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to generate AI tags', { url, error: errorMessage, model: env.OLLAMA_MODEL });
      
      return {
        tags: ['uncategorized'],
        summary: description || undefined,
      };
    }
  }

  static async enhanceDescription(url: string, title: string): Promise<string> {
    try {
      const response = await this.callOllama([
        {
          role: 'system',
          content: 'You are a helpful assistant that creates brief, informative descriptions for bookmarks.',
        },
        {
          role: 'user',
          content: `Create a brief 1-sentence description for this bookmark:\nURL: ${url}\nTitle: ${title}`,
        },
      ]);

      return response.trim() || 'No description available';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to enhance description', { url, error: errorMessage, model: env.OLLAMA_MODEL });
      return 'No description available';
    }
  }
}

