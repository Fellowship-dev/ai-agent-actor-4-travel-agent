import { Log, ApifyClient } from 'apify';
import { createHash } from 'crypto';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { chargeForToolUsage } from '../utils/ppe_handler.js';

/**
 * Interface for parameters required by TripadvisorSearch class.
 */
export interface TripadvisorSearchParams {
  apifyClient: ApifyClient;
  log: Log | Console;
}

/**
 * Tool that uses the TripadvisorSearch function
 */
export class TripadvisorSearch extends StructuredTool {
  protected log: Log | Console;
  protected apifyClient: ApifyClient;

  name = 'tripadvisor_search';

  description = 'Searches for attractions on Tripadvisor based on a city (not a neighborhood) and returns an Apify datasetId to explore the results.';

  schema = z.object({
    location: z.string().describe('Peferred format: "City, Country"'),
  });

  constructor(fields?: TripadvisorSearchParams) {
    super(...arguments);
    this.log = fields?.log ?? console;
    this.apifyClient = fields?.apifyClient ?? new ApifyClient();
  }

  override async _call(arg: z.output<typeof this.schema>) {
    const actorInput = {
      currency: 'USD',
      includeAiReviewsSummary: true,
      includeAttractions: true,
      includeHotels: false,
      includeNearbyResults: false,
      includePriceOffers: false,
      includeRestaurants: true,
      includeTags: true,
      includeVacationRentals: false,
      language: 'en',
      maxItemsPerQuery: 100,
      query: arg.location,
    };
    // checks for cached stored version
    const key = JSON.stringify(actorInput);
    const algorithm = 'sha256';
    const digest = createHash(algorithm).update(key).digest('hex').slice(0, 16);
    const { username } = await this.apifyClient.user().get();
    const today = new Date().toISOString().slice(0, 10);
    const datasetName = `${today}-${digest}`;
    // const datasetName = '2025-03-17-f0fa535166c7c7f3'; //DEBUG
    this.log.debug(`Searching for datasetId: ${username}/${datasetName}`);
    const existingDataset = await this.apifyClient
      .dataset(`${username}/${datasetName}`)
      .get();
    this.log.debug(`Found existingDataset? ${existingDataset}`);
    let totalItems = existingDataset?.itemCount;
    if (existingDataset) {
      this.log.debug(
        `Cached response found for: ${JSON.stringify(actorInput)}`
      );
    } else {
      this.log.debug(
        `Calling TripadvisorSearch with input: ${JSON.stringify(actorInput)}`
      );
      const actorRun = await this.apifyClient
        .actor('maxcopell/tripadvisor')
        .call(actorInput, { maxItems: 100 }); // DEBUG
      await this.apifyClient
        .dataset(actorRun.defaultDatasetId)
        .update({ name: datasetName });
      const dataset = await this.apifyClient
        .dataset(actorRun.defaultDatasetId)
        .listItems();
      totalItems = dataset.total;
      await chargeForToolUsage(this.name, dataset.total);
    }
    this.log.debug(`TripadvisorSearch response: ${username}/${datasetName}`);
    return `Results for Tripadvisor Search can be found in dataset with id '${username}/${datasetName}'. This dataset contains ${totalItems} items in total.`;
  }
}

export default TripadvisorSearch;
