'use strict';

const { buildUpdatedFeed } = require('../src/publisher');

// escapeXml is not exported, so we test it indirectly through buildUpdatedFeed
// and also extract it for direct testing via the module internals.
// Since it's unexported, we test its behaviour via buildUpdatedFeed inputs.

const baseEpisode = {
  title: 'Test Episode',
  date: '2026-02-18',
  fileName: 'episode-2026-02-18.mp3',
  fileSizeBytes: 1000000,
  durationSeconds: 600,
  description: 'A test episode description.',
};

const podcastInfo = {
  title: 'My Podcast',
  author: 'Test Author',
  description: 'A daily briefing.',
};

const baseUrl = 'https://example.github.io/podcast';

// A minimal valid existing feed (matches the structure buildUpdatedFeed produces)
function makeExistingFeed(extraItems = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>My Podcast</title>
    <link>${baseUrl}</link>
    <description>A daily briefing.</description>
    <language>en-us</language>
    <itunes:image href="${baseUrl}/artwork.jpg"/>
    <itunes:author>Test Author</itunes:author>
    <itunes:explicit>false</itunes:explicit>${extraItems}
  </channel>
</rss>`;
}

// ─────────────────────────────────────────────
// buildUpdatedFeed — first run (empty feed)
// ─────────────────────────────────────────────

describe('buildUpdatedFeed — first run (empty existingFeedXml)', () => {
  let result;

  beforeEach(() => {
    result = buildUpdatedFeed('', baseEpisode, baseUrl, podcastInfo);
  });

  test('produces a valid XML declaration', () => {
    expect(result).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  test('includes rss 2.0 root element with iTunes namespace', () => {
    expect(result).toContain('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"');
    expect(result).toContain('<rss version="2.0"');
  });

  test('includes podcast channel metadata', () => {
    expect(result).toContain('<title>My Podcast</title>');
    expect(result).toContain(`<link>${baseUrl}</link>`);
    expect(result).toContain('<itunes:author>Test Author</itunes:author>');
  });

  test('includes the episode item with correct URL', () => {
    const expectedUrl = `${baseUrl}/episodes/${baseEpisode.fileName}`;
    expect(result).toContain(`<enclosure url="${expectedUrl}"`);
    expect(result).toContain(`<guid isPermaLink="true">${expectedUrl}</guid>`);
  });

  test('includes file size and duration', () => {
    expect(result).toContain(`length="${baseEpisode.fileSizeBytes}"`);
    expect(result).toContain(`<itunes:duration>${baseEpisode.durationSeconds}</itunes:duration>`);
  });

  test('includes episode title and description', () => {
    expect(result).toContain('<title>Test Episode</title>');
    expect(result).toContain('<description>A test episode description.</description>');
  });

  test('also handles null existingFeedXml the same as empty string', () => {
    const fromNull = buildUpdatedFeed(null, baseEpisode, baseUrl, podcastInfo);
    expect(fromNull).toMatch(/^<\?xml/);
  });

  test('pubDate uses noon UTC (17:00Z) so the date is unambiguous for CDT listeners', () => {
    // Midnight UTC on a date string like "2026-02-18" appears as the previous evening
    // in CDT (UTC-5). The feed must use a mid-day time to stay on the correct calendar day.
    expect(result).toContain('17:00:00 GMT');
    expect(result).not.toContain('00:00:00 GMT');
  });
});

// ─────────────────────────────────────────────
// buildUpdatedFeed — subsequent run (existing feed)
// ─────────────────────────────────────────────

describe('buildUpdatedFeed — subsequent run (existing feed)', () => {
  test('inserts new item into existing feed', () => {
    const existing = makeExistingFeed();
    const result = buildUpdatedFeed(existing, baseEpisode, baseUrl, podcastInfo);

    expect(result).toContain('<item>');
    expect(result).toContain('Test Episode');
  });

  test('new item appears after </itunes:explicit>', () => {
    const existing = makeExistingFeed();
    const result = buildUpdatedFeed(existing, baseEpisode, baseUrl, podcastInfo);

    const explicitClose = result.indexOf('</itunes:explicit>');
    const itemStart = result.indexOf('<item>');
    expect(itemStart).toBeGreaterThan(explicitClose);
  });

  test('preserves all existing feed content', () => {
    const existing = makeExistingFeed();
    const result = buildUpdatedFeed(existing, baseEpisode, baseUrl, podcastInfo);

    expect(result).toContain('<title>My Podcast</title>');
    expect(result).toContain('<itunes:author>Test Author</itunes:author>');
    expect(result).toContain('</channel>');
    expect(result).toContain('</rss>');
  });

  test('prepends new episode ahead of existing items', () => {
    const existingItem = `
    <item>
      <title>Old Episode</title>
      <description>Old description.</description>
    </item>`;
    const existing = makeExistingFeed(existingItem);
    const result = buildUpdatedFeed(existing, baseEpisode, baseUrl, podcastInfo);

    const newIdx = result.indexOf('Test Episode');
    const oldIdx = result.indexOf('Old Episode');
    expect(newIdx).toBeLessThan(oldIdx);
  });

  test('throws when existing feed is missing </itunes:explicit>', () => {
    const malformed = '<rss><channel><title>Broken</title></channel></rss>';
    expect(() => buildUpdatedFeed(malformed, baseEpisode, baseUrl, podcastInfo))
      .toThrow('Invalid feed XML: missing </itunes:explicit> tag');
  });
});

// ─────────────────────────────────────────────
// XML escaping (tested via episode/podcast fields)
// ─────────────────────────────────────────────

describe('buildUpdatedFeed — XML escaping', () => {
  const specialCharsEpisode = {
    ...baseEpisode,
    title: 'Q&A: "Top 5 <AI> Trends" & More',
    description: "It's a <great> day & night for \"AI\"",
  };

  const specialCharsPodcast = {
    title: 'Podcast & Friends',
    author: "Tyler's Show",
    description: 'The best <podcast> around',
  };

  test('escapes & in episode title', () => {
    const result = buildUpdatedFeed('', specialCharsEpisode, baseUrl, specialCharsPodcast);
    expect(result).toContain('Q&amp;A');
    expect(result).not.toContain('<title>Q&A');
  });

  test('escapes < and > in episode title', () => {
    const result = buildUpdatedFeed('', specialCharsEpisode, baseUrl, specialCharsPodcast);
    expect(result).toContain('&lt;AI&gt;');
  });

  test('escapes " in episode title', () => {
    const result = buildUpdatedFeed('', specialCharsEpisode, baseUrl, specialCharsPodcast);
    expect(result).toContain('&quot;Top 5 &lt;AI&gt; Trends&quot;');
  });

  test("escapes ' in episode description", () => {
    const result = buildUpdatedFeed('', specialCharsEpisode, baseUrl, specialCharsPodcast);
    expect(result).toContain('It&apos;s');
  });

  test('escapes special chars in podcast title', () => {
    const result = buildUpdatedFeed('', baseEpisode, baseUrl, specialCharsPodcast);
    expect(result).toContain('Podcast &amp; Friends');
  });

  test("escapes ' in podcast author", () => {
    const result = buildUpdatedFeed('', baseEpisode, baseUrl, specialCharsPodcast);
    expect(result).toContain('Tyler&apos;s Show');
  });
});
