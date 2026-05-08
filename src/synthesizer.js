/**
 * Script Synthesizer
 *
 * Uses Claude API to generate a spoken-word audio script with Austin weather integration
 */

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

/**
 * Fetch current Austin, TX weather from Open-Meteo API (free, no key needed)
 */
async function fetchAustinWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=30.2672&longitude=-97.7431'
    + '&current=temperature_2m,weathercode,windspeed_10m'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=1';

  const { data } = await axios.get(url);
  const c = data.current;
  const d = data.daily;

  // WMO weather code → human description
  const conditions = {
    0: 'clear skies', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'foggy', 48: 'icy fog', 51: 'light drizzle', 61: 'light rain',
    63: 'moderate rain', 65: 'heavy rain', 71: 'light snow', 80: 'rain showers',
    95: 'thunderstorms',
  };
  const description = conditions[c.weathercode] ?? 'mixed conditions';

  return {
    current: Math.round(c.temperature_2m),
    high: Math.round(d.temperature_2m_max[0]),
    low: Math.round(d.temperature_2m_min[0]),
    precip: d.precipitation_probability_max[0],
    description,
    wind: Math.round(c.windspeed_10m),
  };
}

/**
 * Synthesize audio script from content bundle
 */
async function synthesizeScript(contentBundle, episodeMemory = null) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 60 * 1000, // 60 seconds
  });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });

  // Fetch Austin weather
  const weather = await fetchAustinWeather();
  const weatherSummary = `${weather.description}, currently ${weather.current}°F, `
    + `high of ${weather.high}°F, low of ${weather.low}°F, `
    + `${weather.precip}% chance of rain, winds at ${weather.wind} mph`;

  const memoryContext = episodeMemory
    ? `═══════════════════════════════════════════════
RECENT EPISODE CONTEXT (last 7 days):
═══════════════════════════════════════════════
The following summaries capture what this podcast covered recently. Use this context to create natural continuity — for example, noting when a story has developed since a previous episode, or briefly recapping something relevant before diving deeper. Only reference prior coverage when it genuinely adds value. Never force connections that aren't there.

${episodeMemory}

`
    : '';

  const prompt = `
You are writing the script for "The Data & AI Daily," a two-host personal morning podcast for Tyler.
Today is ${today}. Tyler is based in Austin, Texas.

Austin weather right now: ${weatherSummary}

${memoryContext}The show has two hosts:
- HOST: The primary anchor. Drives the agenda, delivers the main stories, and keeps the episode moving.
- COHOST: The color commentator. Adds reactions, counterpoints, follow-up questions, and personal takes.

Below is the raw content gathered from Databricks sources (blog, newsroom, release notes, exec social posts)
and core AI/ML news sources (major tech outlets, foundation model lab blogs, startup/funding news).

YOUR TASK:
Produce a complete, ready-to-record two-speaker podcast script for an 8–12 minute episode.

═══════════════════════════════════════════════
FORMAT RULES (critical):
═══════════════════════════════════════════════
- Every speaker turn MUST start with a speaker tag on its own line: [HOST] or [COHOST]
- The spoken text for that turn follows on the next line(s).
- Alternate between speakers naturally. Not every exchange needs to be equal length.
- Example:

[HOST]
Good morning, Tyler! Big day in the data world.

[COHOST]
No kidding. I saw the Databricks news drop last night and almost spilled my coffee.

[HOST]
Let's get right into it.

═══════════════════════════════════════════════
STRUCTURE (follow this exactly):
═══════════════════════════════════════════════

[COLD OPEN — 15–30 seconds]
- HOST greets Tyler by name.
- One sentence on what today's episode covers (the "headline of headlines").
- COHOST reacts and weaves in the Austin weather naturally (not as a weather report — more like what a friend would say: "it's looking like a scorcher out there" or "grab a jacket this morning").

[THEME SEGMENTS — 3 to 6 segments, each ~1–2 minutes]
Cluster today's news into 3–6 named themes. Choose theme names that fit the actual news.
Good examples: "Databricks Product & Platform", "Lakehouse Ecosystem & Partners",
"LLM & Agent Breakthroughs", "Regulation & Policy", "Startup & Funding Moves",
"Open Source & Research". Discard low-signal or redundant items — not everything needs coverage.

For each theme segment:
- HOST introduces the theme with a punchy framing sentence, then delivers the core story.
- COHOST jumps in with reactions, follow-up questions, counterpoints, or "why it matters" color.
- Together they explain what happened, why it matters, and who it impacts (call out data engineers,
  ML practitioners, founders, or infra teams specifically when relevant).
- Where relevant, connect Databricks-specific news to the broader AI landscape.
- Add light, confident commentary — both hosts have opinions. Examples of the right tone:
  "This puts real pressure on Snowflake's AI roadmap."
  "Honestly, this is great news for early-stage teams with lean data stacks."
  "I think this is being undersold — here's why it matters."
- Use first-person ("I think", "what I find interesting here is", "we've been watching this").
- Address Tyler by name once or twice across the whole episode — not every segment.
- Transitions between segments should feel natural, not formulaic.

[WRAP-UP — 15–30 seconds]
- HOST gives a quick recap of the 1–2 biggest themes.
- COHOST adds what Tyler should keep an eye on over the coming days.
- Both sign off warmly and personally.

═══════════════════════════════════════════════
STYLE RULES:
═══════════════════════════════════════════════
- Write for the ear, not the eye. Short sentences. Active voice. No bullet points, no URLs, no markdown in the script.
- Conversational and smart — like two well-informed colleagues riffing on the news.
- The banter should feel natural, not forced. Don't overdo the back-and-forth — let each host make substantive points.
- Do NOT pad with filler. If today is a slow news day, say so honestly and go deeper on fewer items.
- Target word count: 1,200–1,800 words (8–12 minutes at a natural speaking pace).
- The ONLY bracketed labels allowed are [HOST] and [COHOST] at the start of each speaker turn.
  No other stage directions, segment headers, or bracketed labels.

═══════════════════════════════════════════════
RAW CONTENT:
═══════════════════════════════════════════════
${JSON.stringify(contentBundle, null, 2)}

Return ONLY the two-speaker script with [HOST] and [COHOST] tags. No other labels, headers, stage directions, or markdown.
`;

  console.log('Synthesizing script with Claude Sonnet 4.6...');

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    if (!message.content || message.content.length === 0) {
      throw new Error('Empty response from Claude API');
    }
    const script = message.content[0].text;
    const wordCount = script.split(/\s+/).length;

    console.log(`  Generated script: ${wordCount} words`);

    // Generate a short summary for the episode description
    console.log('  Generating episode summary...');
    const summaryMessage = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `In 2-3 sentences, summarize the key topics covered in this podcast episode. Write it as a listener-facing description — informative and engaging, no host names or personal references.\n\nScript:\n${script}`,
      }],
    });
    if (!summaryMessage.content || summaryMessage.content.length === 0 || !summaryMessage.content[0].text) {
      throw new Error('Empty summary response from Claude API');
    }
    const summary = summaryMessage.content[0].text.trim();

    // Return script, summary, and combined usage data for cost tracking
    return {
      script,
      summary,
      usage: {
        inputTokens: message.usage.input_tokens + summaryMessage.usage.input_tokens,
        outputTokens: message.usage.output_tokens + summaryMessage.usage.output_tokens,
      },
    };

  } catch (error) {
    console.error('Error synthesizing script:', error.message);
    throw error;
  }
}

module.exports = { synthesizeScript, fetchAustinWeather };
