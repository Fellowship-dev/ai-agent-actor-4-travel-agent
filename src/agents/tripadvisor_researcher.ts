import { Log, ApifyClient } from 'apify';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredToolInterface } from '@langchain/core/tools';
import TripadvisorSearch from '../tools/tripadvisor_search.js';
import { CostHandler } from '../utils/cost_handler.js';

/**
 * Interface for parameters required by ResearcherAgent class.
 */
export interface ResearcherAgentParams {
  apifyClient: ApifyClient,
  modelName: string,
  openaiApiKey: string,
  log: Log | Console;
}

/**
 * An AI Agent that searches Researcher for specific locations and stores the results in a dataset.
 */
export class ResearcherAgent {
  protected log: Log | Console;
  protected apifyClient: ApifyClient;
  public agentExecutor: AgentExecutor;
  public costHandler: CostHandler;

  constructor(fields?: ResearcherAgentParams) {
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
    const tools = this.buildTools(this.apifyClient, this.log);
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

  protected buildTools(
    apifyClient: ApifyClient, log: Log | Console
  ): StructuredToolInterface[] {
    // Tools are initialized to be passed to the agent
    const tripadvisorSearch = new TripadvisorSearch({ apifyClient, log });
    return [
      tripadvisorSearch,
    ];
  }

  protected buildPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ['system',
        'You are a experienced travel agent that knows that Tripadvisor is a website where you can search for tourist attractions based on criteria like location and price. '
        + 'Search on Tripadvisor for the whole city and not only one of the recommended locations for attractions that match the user price and travelers requirements. '
        + 'Inform the user of the assumptions you made to make the Tripadvisor search.'
        + 'Inform the user the datasetId and the amount of items you received from the tripadvisor_search tool in order to explore the results later. '
        + "As your response, return only a JSON object (and nothing more! not even a ```json or ``` wrapper) with the keys 'datasetId' and 'assumptions', with their corresponding values in string format, along with the key 'totalItems' with the number of items in the dataset in number format."
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  }
}

export default ResearcherAgent;
