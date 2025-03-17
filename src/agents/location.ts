import { Log, ApifyClient } from 'apify';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredToolInterface } from '@langchain/core/tools';
import DuckDuckGo from '../tools/duck_duck_go.js';
import WebsiteScraper from '../tools/website_scraper.js';
import { CostHandler } from '../utils/cost_handler.js';

/**
 * Interface for parameters required by LocationAgent class.
 */
export interface LocationAgentParams {
  apifyClient: ApifyClient,
  modelName: string,
  openaiApiKey: string,
  log: Log | Console;
}

/**
 * AI Agent that takes the user input and finds the best Zip Codes in a city to live in.
 */
export class LocationAgent {
  protected log: Log | Console;
  protected apifyClient: ApifyClient;
  public agentExecutor: AgentExecutor;
  public costHandler: CostHandler;

  constructor(fields?: LocationAgentParams) {
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
      maxIterations: 5,
    });
  }

  protected buildTools(
    apifyClient: ApifyClient, log: Log | Console
  ): StructuredToolInterface[] {
    // Tools are initialized to be passed to the agent
    const duckDuckGo = new DuckDuckGo({ apifyClient, log });
    const websiteScraper = new WebsiteScraper({ apifyClient, log });
    return [
      duckDuckGo,
      websiteScraper,
    ];
  }

  protected buildPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ['system',
        'You are a experienced travel agent that wants to help the user plan their trip. '
        + "You will stick to the following steps, ignoring the specifics of the user's query and focusing only on finding the best locations. "
        + 'Step 1. The user will ask you for advice regarding traveling to a specific city in the world or even a neighborhood in a city. '
        + "You don't care where the user lives, since you are not in charge of flights. "
        + 'If the user does not specify a budget, select mid range (and not low budget or luxury). '
        + 'If the user does not provide a country, try to guess to which country the city belongs to. '
        + 'If from the input you cannot get a city and a country or you think that the specified city should not be visited by tourists, '
        + 'end the conversation and help the user with the input. '
        // 2. Fetch best neighborhoods to stay at using DuckDuckGo
        + 'Step 2. With the city and state in hand, use DuckDuckGo replacing the following query: '
        + "'where to stay and where not to stay in [city], [country]'. "
        + 'If there the results, use a website scraper on the URLs you think will show you this information. '
        + 'Iterate until you find the best 3 locations or neighborhoods in the selected city. '
        + "For best performance when using the website scraper, you can use method='getBestPlacesToStay' and output=null'. "
        + 'Instead of answering the original question, just return the top 3 locations or neighborhoods and explain to the user why you selected those locations or neighborhoods. \n'
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  }
}

export default LocationAgent;
