import { Log, ApifyClient } from 'apify';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredToolInterface } from '@langchain/core/tools';
import { CostHandler } from '../utils/cost_handler.js';

/**
 * Interface for parameters required by SuccessAgent class.
 */
export interface SuccessAgentParams {
  apifyClient: ApifyClient,
  modelName: string,
  openaiApiKey: string,
  log: Log | Console;
}

/**
 * An AI Agent summarizes the efforts of all agents to answer the users's question.
 */
export class SuccessAgent {
  protected log: Log | Console;
  protected apifyClient: ApifyClient;
  public agentExecutor: AgentExecutor;
  public costHandler: CostHandler;

  constructor(fields?: SuccessAgentParams) {
    this.log = fields?.log ?? console;
    this.apifyClient = fields?.apifyClient ?? new ApifyClient();
    this.costHandler = new CostHandler(fields?.modelName ?? 'gpt-4o-mini', this.log);
    const llm = new ChatOpenAI({
      model: fields?.modelName,
      apiKey: fields?.openaiApiKey,
      temperature: 0,
      callbacks: [
        this.costHandler,
      ],
    });
    const tools = this.buildTools();
    const prompt = this.buildPrompt();
    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });
    this.agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: false,
      maxIterations: 3,
    });
  }

  protected buildTools(): StructuredToolInterface[] {
    // Tools are initialized to be passed to the agent
    return [];
  }

  protected buildPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ['system',
        'You are a experienced travel agent that wants to help the user plan the perfect trip. '
        + 'You asked some colleagues for help and they sent you a bunch of info to help the user.'
        + 'The user may have specified other requests like pets, preferences, dinners, foods, etc so make sure to mention them. '
        + 'Make sure that you show the rating, price, image, description (or other useful information) and a link to view more information about the chosen results. '
        + 'If more than one location was specified in the search, try to make it so that your recommendations include results in every one of them. '
        + 'Please explain why you chose those results and how many you explored before making your choice. '
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  }
}

export default SuccessAgent;
