import { Log, ApifyClient } from 'apify';
import { createHash } from 'crypto';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { chargeForToolUsage } from '../utils/ppe_handler.js';

/**
 * Interface for parameters required by AirbnbSearch class.
 */
export interface AirbnbSearchParams {
  apifyClient: ApifyClient;
  log: Log | Console;
}

/**
 * Tool that uses the AirbnbSearch function
 */
export class AirbnbSearch extends StructuredTool {
  protected log: Log | Console;
  protected apifyClient: ApifyClient;

  name = 'airbnb_search';

  description = 'Searches for properties on Airbnb based on a list of Zip Codes (at least one) and returns an Apify datasetId to explore the results.';

  schema = z.object({
    locations: z.string().array(),
    minimumPrice: z.number(),
    maximumPrice: z.number(),
    adults: z.number(),
    children: z.number(),
    infants: z.number(),
    pets: z.number().optional(),
    checkIn: z.string().describe('yyyy-mm-dd'),
    checkOut: z.string().describe('yyyy-mm-dd'),
    minBathrooms: z.number().optional(),
    minBedrooms: z.number().optional(),
    minBeds: z.number().optional(),
  });

  constructor(fields?: AirbnbSearchParams) {
    super(...arguments);
    this.log = fields?.log ?? console;
    this.apifyClient = fields?.apifyClient ?? new ApifyClient();
  }

  override async _call(arg: z.output<typeof this.schema>) {
    const actorInput = {
      adults: arg.adults,
      children: arg.children,
      infants: arg.infants,
      pets: arg.pets,
      checkIn: arg.checkIn,
      checkOut: arg.checkOut,
      minBathrooms: arg.minBathrooms,
      minBedrooms: arg.minBedrooms,
      minBeds: arg.minBeds,
      locationQueries: arg.locations.slice(0, 3),
      priceMax: arg.maximumPrice,
      priceMin: arg.minimumPrice,
      currency: 'USD',
      locale: 'en-US',
    };
    // checks for cached stored version
    const key = JSON.stringify(actorInput);
    const algorithm = 'sha256';
    const digest = createHash(algorithm).update(key).digest('hex').slice(0, 16);
    const { username } = await this.apifyClient.user().get();
    const today = new Date().toISOString().slice(0, 10);
    const datasetName = `${today}-${digest}`;
    // const datasetName = '2025-03-11-37d909c75952bc93'; //DEBUG
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
        `Calling AirbnbSearch with input: ${JSON.stringify(actorInput)}`
      );
      const actorRun = await this.apifyClient
        .actor('tri_angle/new-fast-airbnb-scraper')
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
    this.log.debug(`AirbnbSearch response: ${username}/${datasetName}`);
    return `Results for Airbnb Search can be found in dataset with id '${username}/${datasetName}'. This dataset contains ${totalItems} items in total.`;
  }
}

export default AirbnbSearch;
