import { AIProvider } from './AIProvider';
import { AnalysisContext, SemanticAnalysis } from '../types/ai';

export class SemanticAnalyzer {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  async analyzeChanges(context: AnalysisContext): Promise<SemanticAnalysis> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildAnalysisPrompt(context);

    try {
      const response = await this.provider.analyze(userPrompt, systemPrompt);
      return this.parseAnalysisResponse(response.content);
    } catch (error: any) {
      throw new Error(`Semantic analysis failed: ${error.message}`);
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert software development observer and technical writer. Your role is to analyze code changes and provide semantic understanding of what developers are building.

Your analysis should:
1. Go beyond syntax to understand the intent and purpose
2. Recognize architectural patterns and design decisions
3. Categorize changes accurately (feature, fix, refactor, docs, style, test)
4. Assess the impact on the codebase
5. Identify affected areas and components
6. Provide clear, human-readable summaries

Always respond in JSON format with the following structure:
{
  "summary": "Brief human-readable summary of the changes",
  "category": "feature|fix|refactor|docs|style|test",
  "impact": "low|medium|high",
  "affectedAreas": ["area1", "area2"],
  "technicalDetails": "Detailed technical explanation",
  "suggestedDocumentation": "Optional documentation suggestions"
}`;
  }

  private buildAnalysisPrompt(context: AnalysisContext): string {
    const { files, diff, projectContext } = context;

    let prompt = `Analyze the following code changes:\n\n`;

    // Project context
    prompt += `## Project Context\n`;
    prompt += `- Name: ${projectContext.name}\n`;
    prompt += `- Tech Stack: ${projectContext.techStack.join(', ')}\n`;
    prompt += `- Architecture: ${projectContext.architecture}\n\n`;

    // Files changed
    prompt += `## Files Changed\n`;
    files.forEach((file) => {
      prompt += `- ${file.path} (${file.changeType})\n`;
    });
    prompt += `\n`;

    // Git diff
    if (diff && diff.length > 0) {
      prompt += `## Changes (Git Diff)\n`;
      prompt += `\`\`\`diff\n${diff.substring(0, 3000)}\n\`\`\`\n\n`;
    }

    prompt += `Provide a semantic analysis of these changes in JSON format.`;

    return prompt;
  }

  private parseAnalysisResponse(content: string): SemanticAnalysis {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const parsed = JSON.parse(jsonStr);

      return {
        summary: parsed.summary || 'Code changes detected',
        category: this.validateCategory(parsed.category),
        impact: this.validateImpact(parsed.impact),
        affectedAreas: Array.isArray(parsed.affectedAreas) ? parsed.affectedAreas : [],
        technicalDetails: parsed.technicalDetails || '',
        suggestedDocumentation: parsed.suggestedDocumentation,
      };
    } catch (error) {
      // Fallback if parsing fails
      return {
        summary: content.substring(0, 200),
        category: 'refactor',
        impact: 'medium',
        affectedAreas: [],
        technicalDetails: content,
      };
    }
  }

  private validateCategory(
    category: string
  ): 'feature' | 'fix' | 'refactor' | 'docs' | 'style' | 'test' {
    const validCategories = ['feature', 'fix', 'refactor', 'docs', 'style', 'test'];
    return validCategories.includes(category) ? (category as any) : 'refactor';
  }

  private validateImpact(impact: string): 'low' | 'medium' | 'high' {
    const validImpacts = ['low', 'medium', 'high'];
    return validImpacts.includes(impact) ? (impact as any) : 'medium';
  }

  async summarizeProject(context: AnalysisContext): Promise<string> {
    const systemPrompt = `You are a technical writer creating project summaries. Provide a clear, concise overview of the project's current state.`;

    const userPrompt = `Create a project summary for:

Project: ${context.projectContext.name}
Tech Stack: ${context.projectContext.techStack.join(', ')}
Architecture: ${context.projectContext.architecture}

Recent changes:
${context.projectContext.recentChanges?.join('\n') || 'No recent changes'}

Provide a 2-3 paragraph summary of the project's current state and progress.`;

    try {
      const response = await this.provider.analyze(userPrompt, systemPrompt);
      return response.content;
    } catch (error: any) {
      throw new Error(`Project summary failed: ${error.message}`);
    }
  }
}
