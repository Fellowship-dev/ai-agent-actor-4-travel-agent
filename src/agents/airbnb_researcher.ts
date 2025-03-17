import { Log, ApifyClient } from 'apify';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredToolInterface } from '@langchain/core/tools';
import AirbnbSearch from '../tools/airbnb_search.js';
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
    const airbnbSearch = new AirbnbSearch({ apifyClient, log });
    return [
      airbnbSearch,
    ];
  }

  protected buildPrompt(): ChatPromptTemplate {
    const today = new Date().toISOString().slice(0, 10);
    return ChatPromptTemplate.fromMessages([
      ['system',
        'You are a experienced travel agent that knows that Airbnb is a website where you can search for places to stay based on criteria like location, dates and price. '
        + 'Using the recommended locations, search on Airbnb for places that match the user price, date and travelers (adults, children and pets) requirements. '
        + 'The user must specify who is traveling (adults, children, infants, pets) (default to 2 adults if the information is not given). '
        + `When managing dates, you always try to use the best format in the world, which is: yyy-mm-dd. For any calculation assume that today is ${today}.`
        + 'The user can specify if the travel has a start date (default to a trip of one week if the information is not given and choose today if no start date is available). '
        + 'The user can specify if the travel has an end date (default to a trip of one week if the information is not given and choose today if no start date is available). '
        + 'The user can specify if the travel destination has a minimum value (default to 1 if the information is not given). '
        + 'The user can specify if the travel destination has a maximum value (default to 250 if the information is not given). '
        + 'The user can specify a minimum number of baths, beds or bedrooms (omit these search parameters if the information is not given). '
        + 'Inform the user of the assumptions you made to make the Airbnb search.'
        + 'Inform the user the datasetId and the amount of items you received from the airbnb_search tool in order to explore the results later. '
        + "As your response, return only a JSON object (and nothing more! not even a ```json or ``` wrapper) with the keys 'datasetId' and 'assumptions', with their corresponding values in string format, along with the key 'totalItems' with the number of items in the dataset in number format."
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  }
}

export default ResearcherAgent;
