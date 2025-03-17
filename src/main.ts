import dotenv from 'dotenv';
import { Actor, ApifyClient, log } from 'apify';
import { StateGraph, StateGraphArgs, START, END } from '@langchain/langgraph';
import LocationAgent from './agents/location.js';
import DeciderAgent from './agents/decider.js';
import ResearcherAgent from './agents/researcher.js';
import SuccessAgent from './agents/success.js';
import { chargeForActorStart } from './utils/ppe_handler.js';

// if available, .env variables are loaded
dotenv.config();

/**
 * Actor input schema
 */
type Input = {
  instructions: string;
  modelName?: string;
  openaiApiKey?: string;
  debug?: boolean;
}

/**
 * Actor initialization code and initial charge
*/
await Actor.init();
await chargeForActorStart();

// Handle and validate input
const {
  instructions,
  modelName = 'gpt-4o-mini',
  openaiApiKey,
  debug,
} = await Actor.getInput() as Input;
if (debug) {
  log.setLevel(log.LEVELS.DEBUG);
} else {
  log.setLevel(log.LEVELS.INFO);
}
// if available, the Actor uses the user's openaiApiKey. Otherwise it charges for use.
const tokenCostActive = (openaiApiKey ?? '').length === 0;
if (tokenCostActive) {
  log.info("No openaiApiKey was detected. You'll be charged for token usage.");
} else {
  log.info("Env openaiApiKey detected. You won't be charged for token usage.");
}
if (!instructions) {
  throw new Error('Instructions are required. Create an INPUT.json file in the `storage/key_value_stores/default` folder and add the respective keys.');
}

// Apify is used to call tools and manage datasets
const userToken = process.env.USER_APIFY_TOKEN;
if (!userToken) {
  throw new Error('User token is required. Export your Apify secret as USER_APIFY_TOKEN.');
}
const apifyClient = new ApifyClient({
  token: userToken,
});

/**
 * LangGraph StateGraph schema
 */
type StateSchema = {
  instructions: string;
  bestLocations: string;
  datasetId: string;
  totalItems: number;
  assumptions: string;
  itemsChecked: number;
  recommendations: string[];
  output: string;
}

const graphState: StateGraphArgs<StateSchema>['channels'] = {
  instructions: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => instructions,
  },
  bestLocations: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
  datasetId: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
  totalItems: {
    value: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  },
  assumptions: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
  itemsChecked: {
    value: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  },
  recommendations: {
    value: (x?: string[], y?: string[]) => y ?? x ?? [],
    default: () => [],
  },
  output: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
};

async function locationNode(state: StateSchema) {
  const locationAgent = new LocationAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = locationAgent;
  const response = await agentExecutor.invoke({ input: state.instructions });
  log.debug(`locationAgent 🤖 : ${response.output}`);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return { bestLocations: response.output };
}

async function researcherNode(state: StateSchema) {
  const researcherAgent = new ResearcherAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = researcherAgent;
  const input = 'The user asked sent this exact query:\n\n'
    + `'${state.instructions}'\n\n`
    + 'You asked someone for help to get the best locations in that city and country. '
    + 'The answer you received was this:\n\n'
    + `'${state.bestLocations}'\n\n`
    + 'Please make some research to gather information to be able to answer the user accordingly.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`researcherAgent 🤖 : ${response.output}`);
  const { datasetId, totalItems, assumptions } = JSON.parse(response.output);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return { datasetId, totalItems, assumptions };
}

async function deciderNode(state: StateSchema) {
  const deciderAgent = new DeciderAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = deciderAgent;
  const input = 'The user asked sent this exact query:\n\n'
    + `'${state.instructions}'\n\n`
    + 'You asked someone for help to get the best locations in that city and country. '
    + 'The answer you received was this:\n\n'
    + `'${state.bestLocations}'\n\n`
    + 'You asked someone else for help to get the best places to stay in in those locations using Airbnb. '
    + 'The answer you received was this:\n\n'
    + `Airbnb Apify dataset ID: '${state.datasetId}'\n`
    + `Total items in Airbnb dataset: '${state.totalItems}'\n`
    + `Assumptions made when cretating the Airbnb dataset:: '${state.assumptions}'\n`
    + `Total results already checked in Airbnb dataset: itemsChecked='${state.itemsChecked}'\n\n`
    + 'Please explore theavailable datasets for the best results.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`deciderAgent 🤖 : ${response.output}`);
  const { itemsChecked, recommendations } = JSON.parse(response.output);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return {
    itemsChecked: state.itemsChecked + itemsChecked,
    recommendations: [...state.recommendations, ...recommendations]
  };
}

const resultsCheckedRouter = (state: StateSchema) => {
  const allResultsChecked = state.itemsChecked >= state.totalItems;
  log.debug(`allResultsChecked: ${allResultsChecked}`);
  const thousandResultsChecked = state.itemsChecked > 1000;
  log.debug(`thousandResultsChecked: ${thousandResultsChecked}`);
  const fifteenRecommendationsFound = state.recommendations.length > 15;
  log.debug(`fifteenRecommendationsFound: ${fifteenRecommendationsFound}`);
  if (
    allResultsChecked
    || thousandResultsChecked
    || fifteenRecommendationsFound
  ) {
    // if any of the above criteria are met, it passes the ball to the successAgent
    return 'success';
  }
  // if none of the above criteria are met, it runs the same node again
  return 'decider';
};

async function successNode(state: StateSchema) {
  const successAgent = new SuccessAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = successAgent;
  const input = 'The user asked sent this exact query:\n\n'
    + `'${state.instructions}'\n\n`
    + 'You asked someone for help to get the best locations in that city and state. '
    + 'The answer you received was this:\n\n'
    + `'${state.bestLocations}'\n\n`
    + 'You asked someone else for help to get the best places to stay in those locations using Airbnb and their expert jugdgement. '
    + 'The answer you received was this:\n\n'
    + `Assumptions made when searching Airbnb: '${state.assumptions}'\n\n`
    + `Total places to stay checked: '${state.itemsChecked}'\n`
    + `Total places to stay recommended: '${state.recommendations.length}'\n`
    + `Best places to stay in stringified JSON format: '${JSON.stringify(state.recommendations)}'\n`
    + 'Please select the top 5 places to stay and answer the user explaining the whole process in markdown format.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`successNode 🤖 : ${response.output}`);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return { output: response.output };
}

const graph = new StateGraph({ channels: graphState })
  .addNode('location', locationNode)
  .addNode('researcher', researcherNode)
  .addNode('decider', deciderNode)
  .addNode('success', successNode)
  .addEdge(START, 'location')
  .addEdge('location', 'researcher')
  .addEdge('researcher', 'decider')
  .addConditionalEdges('decider', resultsCheckedRouter)
  .addEdge('success', END);

const runnable = graph.compile();

const response = await runnable.invoke(
  { input: instructions },
  { configurable: { thread_id: 42 } }, // this line shows that the agent can be thread-aware
);

log.debug(`Agent 🤖 : ${response.output}`);

await Actor.pushData({
  actorName: 'AI Travel Agent',
  response: response.output,
});

await Actor.exit();
