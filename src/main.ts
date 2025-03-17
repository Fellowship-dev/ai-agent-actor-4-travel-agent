import dotenv from 'dotenv';
import { Actor, ApifyClient, log } from 'apify';
import { StateGraph, StateGraphArgs, START, END } from '@langchain/langgraph';
import LocationAgent from './agents/location.js';
import AirbnbDeciderAgent from './agents/airbnb_decider.js';
import AirbnbResearcherAgent from './agents/airbnb_researcher.js';
import SuccessAgent from './agents/success.js';
import TripadvisorDeciderAgent from './agents/tripadvisor_decider.js';
import TripadvisorResearcherAgent from './agents/tripadvisor_researcher.js';
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
  airbnbDatasetId: string;
  airbnbTotalItems: number;
  airbnbAssumptions: string;
  airbnbItemsChecked: number;
  airbnbRecommendations: string[];
  tripadvisorDatasetId: string;
  tripadvisorTotalItems: number;
  tripadvisorAssumptions: string;
  tripadvisorItemsChecked: number;
  tripadvisorRecommendations: string[];
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
  airbnbDatasetId: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
  airbnbTotalItems: {
    value: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  },
  airbnbAssumptions: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
  airbnbItemsChecked: {
    value: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  },
  airbnbRecommendations: {
    value: (x?: string[], y?: string[]) => y ?? x ?? [],
    default: () => [],
  },
  tripadvisorDatasetId: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
  tripadvisorTotalItems: {
    value: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  },
  tripadvisorAssumptions: {
    value: (x?: string, y?: string) => y ?? x ?? '',
    default: () => '',
  },
  tripadvisorItemsChecked: {
    value: (x?: number, y?: number) => y ?? x ?? 0,
    default: () => 0,
  },
  tripadvisorRecommendations: {
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

async function airbnbResearcherNode(state: StateSchema) {
  const airbnbResearcherAgent = new AirbnbResearcherAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = airbnbResearcherAgent;
  const input = 'The user asked sent this exact query:\n\n'
    + `'${state.instructions}'\n\n`
    + 'You asked someone for help to get the best locations in that city and country. '
    + 'The answer you received was this:\n\n'
    + `'${state.bestLocations}'\n\n`
    + 'Please make some research to gather information to be able to answer the user accordingly.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`airbnbResearcherAgent 🤖 : ${response.output}`);
  const { datasetId, totalItems, assumptions } = JSON.parse(response.output);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return {
    airbnbDatasetId: datasetId,
    airbnbTotalItems: totalItems,
    airbnbAssumptions: assumptions,
  };
}

async function airbnbDeciderNode(state: StateSchema) {
  const airbnbDeciderAgent = new AirbnbDeciderAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = airbnbDeciderAgent;
  const input = 'The user asked sent this exact query:\n\n'
    + `'${state.instructions}'\n\n`
    + 'You asked someone for help to get the best locations in that city and country. '
    + 'The answer you received was this:\n\n'
    + `'${state.bestLocations}'\n\n`
    + 'You asked someone else for help to get the best places to stay in in those locations using Airbnb. '
    + 'The answer you received was this:\n\n'
    + `Airbnb Apify dataset ID: '${state.airbnbDatasetId}'\n`
    + `Total items in Airbnb dataset: '${state.airbnbTotalItems}'\n`
    + `Assumptions made when cretating the Airbnb dataset:: '${state.airbnbAssumptions}'\n`
    + `Total results already checked in Airbnb dataset: airbnbItemsChecked='${state.airbnbItemsChecked}'\n\n`
    + 'Please explore theavailable datasets for the best results.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`airbnbDeciderAgent 🤖 : ${response.output}`);
  const { itemsChecked, recommendations } = JSON.parse(response.output);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return {
    airbnbItemsChecked: state.airbnbItemsChecked + itemsChecked,
    airbnbRecommendations: [
      ...state.airbnbRecommendations,
      ...recommendations
    ]
  };
}

const airbnbResultsRouter = (state: StateSchema) => {
  const allResultsChecked = state.airbnbItemsChecked >= state.airbnbTotalItems;
  log.debug(`allResultsChecked: ${allResultsChecked}`);
  const hundredResultsChecked = state.airbnbItemsChecked > 100;
  log.debug(`hundredResultsChecked: ${hundredResultsChecked}`);
  const fiveRecommendationsFound = state.airbnbRecommendations.length > 5;
  log.debug(`fiveRecommendationsFound: ${fiveRecommendationsFound}`);
  if (
    allResultsChecked
    || hundredResultsChecked
    || fiveRecommendationsFound
  ) {
    // if any of the above criteria are met, it passes the ball to the successAgent
    return 'success';
  }
  // if none of the above criteria are met, it runs the same node again
  return 'airbnbDecider';
};

async function tripadvisorResearcherNode(state: StateSchema) {
  const tripadvisorResearcherAgent = new TripadvisorResearcherAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = tripadvisorResearcherAgent;
  const input = 'The user asked sent this exact query:\n\n'
    + `'${state.instructions}'\n\n`
    + 'You asked someone for help to get the best locations in that city and country. '
    + 'The answer you received was this:\n\n'
    + `'${state.bestLocations}'\n\n`
    + 'Please make some research to gather information to be able to answer the user accordingly.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`tripadvisorResearcherAgent 🤖 : ${response.output}`);
  const { datasetId, totalItems, assumptions } = JSON.parse(response.output);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return {
    tripadvisorDatasetId: datasetId,
    tripadvisorTotalItems: totalItems,
    tripadvisorAssumptions: assumptions,
  };
}

async function tripadvisorDeciderNode(state: StateSchema) {
  const tripadvisorDeciderAgent = new TripadvisorDeciderAgent({
    apifyClient,
    modelName,
    openaiApiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
    log,
  });
  const { agentExecutor, costHandler } = tripadvisorDeciderAgent;
  const input = 'The user asked sent this exact query:\n\n'
    + `'${state.instructions}'\n\n`
    + 'You asked someone for help to get the best locations in that city and country. '
    + 'The answer you received was this:\n\n'
    + `'${state.bestLocations}'\n\n`
    + 'You asked someone else for help to get the attractions in in those locations using Tripadvisor. '
    + 'The answer you received was this:\n\n'
    + `Tripadvisor Apify dataset ID: '${state.tripadvisorDatasetId}'\n`
    + `Total items in Tripadvisor dataset: '${state.tripadvisorTotalItems}'\n`
    + `Assumptions made when cretating the Tripadvisor dataset:: '${state.tripadvisorAssumptions}'\n`
    + `Total results already checked in Tripadvisor dataset: tripadvisorItemsChecked='${state.tripadvisorItemsChecked}'\n\n`
    + 'Please explore theavailable datasets for the best results.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`tripadvisorDeciderAgent 🤖 : ${response.output}`);
  const { itemsChecked, recommendations } = JSON.parse(response.output);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return {
    tripadvisorItemsChecked: state.tripadvisorItemsChecked + itemsChecked,
    tripadvisorRecommendations: [
      ...state.tripadvisorRecommendations, ...recommendations
    ]
  };
}

const tripadvisorResultsRouter = (state: StateSchema) => {
  const allResultsChecked = state.tripadvisorItemsChecked
    >= state.tripadvisorTotalItems;
  log.debug(`allResultsChecked: ${allResultsChecked}`);
  const hundredResultsChecked = state.tripadvisorItemsChecked > 100;
  log.debug(`hundredResultsChecked: ${hundredResultsChecked}`);
  const fiveRecommendationsFound = state.tripadvisorRecommendations.length > 5;
  log.debug(`fiveRecommendationsFound: ${fiveRecommendationsFound}`);
  if (
    allResultsChecked
    || hundredResultsChecked
    || fiveRecommendationsFound
  ) {
    // if any of the above criteria are met, it passes the ball to the successAgent
    return 'success';
  }
  // if none of the above criteria are met, it runs the same node again
  return 'tripadvisorDecider';
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
    + `Assumptions made when searching Airbnb: '${state.tripadvisorAssumptions}'\n\n`
    + `Total places to stay checked: '${state.tripadvisorItemsChecked}'\n`
    + `Total places to stay recommended: '${state.tripadvisorRecommendations.length}'\n`
    + `Best places to stay in stringified JSON format: '${JSON.stringify(state.tripadvisorRecommendations)}'\n`
    + 'You asked someone else for help to get the attractions in those locations using Tripadvisor and their expert jugdgement. '
    + 'The answer you received was this:\n\n'
    + `Assumptions made when searching Tripadvisor: '${state.tripadvisorAssumptions}'\n\n`
    + `Total attractions checked: '${state.tripadvisorItemsChecked}'\n`
    + `Total attractions recommended: '${state.tripadvisorRecommendations.length}'\n`
    + `Best attractions in stringified JSON format: '${JSON.stringify(state.tripadvisorRecommendations)}'\n`
    + 'Please mention the explored neighborhoods and their descriptions to the user.'
    + 'Please select the top 3 places to stay and recommend the top 3 attractions (hopefully in the same neighborhoods).'
    + 'Please answer the user explaining the whole process in markdown format.';
  const response = await agentExecutor.invoke({ input });
  log.debug(`successNode 🤖 : ${response.output}`);
  await costHandler.logOrChargeForTokens(modelName, tokenCostActive);
  return { output: response.output };
}

const graph = new StateGraph({ channels: graphState })
  .addNode('location', locationNode)
  .addNode('airbnbResearcher', airbnbResearcherNode)
  .addNode('airbnbDecider', airbnbDeciderNode)
  .addNode('tripadvisorResearcher', tripadvisorResearcherNode)
  .addNode('tripadvisorDecider', tripadvisorDeciderNode)
  .addNode('success', successNode)
  .addEdge(START, 'location')
  .addEdge('location', 'airbnbResearcher')
  .addEdge('airbnbResearcher', 'airbnbDecider')
  .addConditionalEdges('airbnbDecider', airbnbResultsRouter)
  .addEdge('location', 'tripadvisorResearcher')
  .addEdge('tripadvisorResearcher', 'tripadvisorDecider')
  .addConditionalEdges('tripadvisorDecider', tripadvisorResultsRouter)
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
