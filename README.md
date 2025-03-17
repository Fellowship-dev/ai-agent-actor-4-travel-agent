[![Actor AI Travel Agent](https://apify.com/actor-badge?actor=maxfindel/ai-travel-agent)](https://apify.com/maxfindel/ai-travel-agent)

# AI Travel Agent

## Introduction
The **AI Travel Agent** is designed to assist users in planning their perfect trip through a simple conversational interface. With this agent, users can input specific criteria for their desired destination, such as neighborhood and budget, and receive tailored suggestions.

### Key Features
- Chat-based interaction for personalized trip planning.
- Integration with OpenAI's advanced models for natural language understanding.
- Supports multiple GPT models based on user preference.
- Uses cache based on input to reduce time and cost of tool usage.
- Leverages LangGraph nodes to perform multiple commands without exceeding the token limit.

### Supported tools by AI Agent
- Explores Apify Datasets using pagination (to avoid excessive token usage)
- Searches the web using Duck Duck Go and scrapes the results for answers
- Searches Airbnb using "the best locations in town" and specific filters

## How to Use the AI Travel Agent
1. **Input Instructions**: Provide specific requirements, such as "I want to travel with my partner to Barcelona next month and I'm on a budget."
2. **Bring your own LLM (optional)**: Use your own OpenAI API key from [OpenAI platform](https://platform.openai.com/account/api-keys) and select your preferred GPT model. If left blank, we'll use ours and charge you for token usage.
3. **Receive Results**: The agent will generate a list of suitable properties based on your criteria.

## Pricing Explanation
The AI Travel Agent uses a **PAY PER EVENT** pricing model. Below are some of the key pricing structures:

| Event | Description | Price (USD) |
| --- | --- | --- |
| Actor start per 1 GB | Flat fee for starting an Actor run for each 1 GB of memory.| $0.01 |
| Price per 1000 OpenAI tokens for gpt-4o | Flat fee for every 1000 tokens (input/output) used with gpt-4o.| $0.01 |
| Price per web page scraped | Flat fee for every web page scraped. | $0.01 |
| Price per Duck Duck Go search | Flat fee for every Duck Duck Go search. | $0.01 |
| Price per result when searching Airbnb | Flat fee for every result when searching Airbnb. | $0.005 |`

## Input Requirements
The following fields are recommeded to start using the AI Travel Agent:

```json
{
  "instructions": "Ask the agent for help to plan the perfect trip.",
  "openaiApiKey": "YOUR_OPENAI_API_KEY", // optional
  "model": "gpt-4o-mini"
}
```

## AI Agent Flow Chart
![Mermaid Flow Chart](https://github.com/Fellowship-dev/ai-agent-actor-5-real-state-agent/blob/main/mermaid.png?raw=true)

## Expected Output
Upon successful execution, the expected output will resemble the following markdown format:

```
Sure! I explored a total of **100 places** to stay in Barcelona and selected the **top 5** based on their ratings, price, and location. Here are my recommendations for your week-long trip to Barcelona next month:

### 1. H52MPS21 Cute Apartment with Balcony
- **Rating**: 4.73 out of 5 (204 reviews)
- **Price**: $197 per night (originally $257)
- **Total for 7 nights**: $1,375
- **Description**: A charming apartment featuring a lovely balcony, perfect for enjoying the Barcelona weather.
- **Amenities**: 1 bedroom, 1 bed.
- **Location**: Centrally located in Eixample, close to major attractions.
- **[View More](https://www.airbnb.com/rooms/17039212?locale=en-US&currency=USD&adults=2&children=0&infants=0&pets=0&check_in=2025-04-01&check_out=2025-04-08)**
![H52MPS21 Cute Apartment with Balcony](https://a0.muscache.com/im/pictures/miso/Hosting-17039212/original/33ad4c8a-5721-4152-9620-2d69212cf1e3.jpeg)

---

### 2. Sunny Design Apartment in the Center
- **Rating**: 4.84 out of 5 (188 reviews)
- **Price**: $203 per night
- **Total for 7 nights**: $1,417
- **Description**: A beautifully designed apartment located in the heart of Barcelona, ideal for exploring the city.
- **Amenities**: 1 bedroom, 2 beds.
- **Location**: Eixample, close to shopping and dining.
- **[View More](https://www.airbnb.com/rooms/27724507?locale=en-US&currency=USD&adults=2&children=0&infants=0&pets=0&check_in=2025-04-01&check_out=2025-04-08)**
![Sunny Design Apartment in the Center](https://a0.muscache.com/im/pictures/hosting/Hosting-U3RheVN1cHBseUxpc3Rpbmc6Mjc3MjQ1MDc%3D/original/f7a4fc53-a4d7-4693-b455-cd20bee03bcb.jpeg)

---

### 3. H5ANEP1 Beautiful Apartment Next to Sagrada
- **Rating**: 4.75 out of 5 (220 reviews)
- **Price**: $184 per night (originally $234)
- **Total for 7 nights**: $1,284
- **Description**: A stunning apartment located near the iconic Sagrada Familia, perfect for sightseeing.
- **Amenities**: 1 bedroom, 1 bed.
- **Location**: Eixample, close to major landmarks.
- **[View More](https://www.airbnb.com/rooms/17151552?locale=en-US&currency=USD&adults=2&children=0&infants=0&pets=0&check_in=2025-04-01&check_out=2025-04-08)**
![H5ANEP1 Beautiful Apartment Next to Sagrada](https://a0.muscache.com/im/pictures/de701a89-d3b3-4e09-982d-b0fd756e7cbe.jpg)

---

### 4. Cozy Apartment for Two Close to Camp Nou
- **Rating**: 4.89 out of 5 (47 reviews)
- **Price**: $142 per night (originally $157)
- **Total for 7 nights**: $992
- **Description**: A cozy and newly renovated apartment, perfect for couples or solo travelers.
- **Amenities**: Studio, 1 bed.
- **Location**: L'Hospitalet de Llobregat, a short distance from Camp Nou.
- **[View More](https://www.airbnb.com/rooms/1086535437179140288?locale=en-US&currency=USD&adults=2&children=0&infants=0&pets=0&check_in=2025-04-01&check_out=2025-04-08)**
![Cozy Apartment for Two Close to Camp Nou](https://a0.muscache.com/im/pictures/miso/Hosting-1086535437179140288/original/7b637fc7-9632-454a-9b56-bbb6299fdf7d.jpeg)

---

### 5. Sweett | Sepulveda Atic
- **Rating**: 4.62 out of 5 (87 reviews)
- **Price**: $223 per night (originally $261)
- **Total for 7 nights**: $1,560
- **Description**: A stylish attic apartment with great views, perfect for a romantic getaway.
- **Amenities**: 1 bedroom, 1 bed.
- **Location**: Eixample, close to public transport.
- **[View More](https://www.airbnb.com/rooms/42373718?locale=en-US&currency=USD&adults=2&children=0&infants=0&pets=0&check_in=2025-04-01&check_out=2025-04-08)**
![Sweett | Sepulveda Atic](https://a0.muscache.com/im/pictures/prohost-api/Hosting-42373718/original/cb5d4d66-a44f-4b47-93a6-2426a412ea4a.jpeg)

---

### Summary
These options were selected based on their high ratings, reasonable prices, and prime locations in Barcelona. Each of these accommodations offers a unique experience, whether you prefer the vibrant atmosphere of Eixample or the historical charm of the Gothic Quarter. 

If you have any specific preferences or additional requests, feel free to let me know!
```

## FAQ
**Q: What is the best way to use the AI Travel Agent?**  
A: Provide clear and specific instructions to get the most relevant results.

**Q: How can I obtain an OpenAI API key?**  
A: You can get your API key from the [OpenAI platform](https://platform.openai.com/account/api-keys).

**Q: Is there a free tier available?**  
A: The model operates on a pay-per-event basis, and charges apply based on the usage.

For further assistance, feel free to reach out to the developer via Apify.
