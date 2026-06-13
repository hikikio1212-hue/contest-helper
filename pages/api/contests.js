import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청 방법이에요.' });

  const { sites = [] } = req.body;
  const results = [];
  const siteStatus = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9',
  };

  for (const site of sites) {
    try {
      let contests = [];

      if (site.id === 'wevity') {
        const { data } = await axios.get('https://www.wevity.com/?c=find&s=1&gub=1', { headers, timeout: 12000 });
        const $ = cheerio.load(data);
        $('ul.list > li, .list-item, .contest-item').each((_, el) => {
          const title     = $(el).find('.tit, .title, h4, h3').first().text().trim();
          const host      = $(el).find('.host, .company, .organ').first().text().trim();
          const deadline  = $(el).find('.date, .dday, .d-day').first().text().trim();
          const prize     = $(el).find('.prize, .reward').first().text().trim();
          const href      = $(el).find('a').first().attr('href');
          const detailUrl = href ? (href.startsWith('http') ? href : 'https://www.wevity.com' + href) : '';
          if (title) contests.push({ title, host, deadline, prize, source: '위비티', detailUrl, region: '', category: '' });
        });
        if (!contests.length) {
          $('a[href*="idx"]').each((_, el) => {
            const title = $(el).text().trim();
            if (title.length > 5 && title.length < 80) {
              const href = $(el).attr('href');
              const detailUrl = href ? (href.startsWith('http') ? href : 'https://www.wevity.com' + href) : '';
              contests.push({ title, host: '', deadline: '', prize: '', source: '위비티', detailUrl, region: '', category: '' });
            }
          });
        }
      } else if (site.id === 'contest') {
        const { data } = await axios.get('https://www.contestkorea.com/sub/list.php?int_gbn=1&Txt_bcode=030510001', { headers, timeout: 12000 });
        const $ = cheerio.load(data);
        $('ul.list_style_1 > li, .list_area li').each((_, el) => {
          const title     = $(el).find('a strong, .tit').first().text().trim();
          const host      = $(el).find('.host, .organ, .group').first().text().trim();
          const deadline  = $(el).find('.dday, .date').first().text().trim();
          const prize     = $(el).find('.prize, .award').first().text().trim();
          const href      = $(el).find('a').first().attr('href');
          const detailUrl = href ? (href.startsWith('http') ? href : 'https://www.contestkorea.com' + href) : '';
          if (title) contests.push({ title, host, deadline, prize, source: '콘테스트코리아', detailUrl, region: '', category: '' });
        });
      } else if (site.id === 'thinkgood') {
        const { data } = await axios.get('https://www.thinkcontest.com/Contest/list.html', { headers, timeout: 12000 });
        const $ = cheerio.load(data);
        const seen = new Set();
        $('.list_bx li, .contest_list li, .board_list li').each((_, el) => {
          const title     = $(el).find('.tit, .title, strong').first().text().trim();
          const host      = $(el).find('.organ, .host, .name').first().text().trim();
          const deadline  = $(el).find('.date, .dday').first().text().trim();
          const prize     = $(el).find('.prize').first().text().trim();
          const href      = $(el).find('a').first().attr('href');
          const detailUrl = href ? (href.startsWith('http') ? href : 'https://www.thinkcontest.com' + href) : '';
          if (title && title.length > 5 && !seen.has(title)) {
            seen.add(title);
            contests.push({ title, host, deadline, prize, source: '씽굿', detailUrl, region: '', category: '' });
          }
        });
      } else {
        const { data } = await axios.get(site.url, { headers, timeout: 12000 });
        const $ = cheerio.load(data);
        $('script, style, nav, footer, header').remove();
        const seen = new Set();
        $('a').each((_, el) => {
          const title = $(el).text().trim();
          const href  = $(el).attr('href');
          if (title.length > 8 && title.length < 80 && href && !seen.has(title)) {
            seen.add(title);
            const detailUrl = href.startsWith('http') ? href : new URL(href, site.url).href;
            contests.push({ title, host: '', deadline: '', prize: '', source: site.name, detailUrl, region: '', category: '' });
          }
        });
        contests = contests.slice(0, 30);
      }

      siteStatus.push({ name: site.name, success: true, count: contests.length });
      results.push(...contests);
    } catch (e) {
      siteStatus.push({ name: site.name, success: false, count: 0, error: e.message });
    }
  }

  res.json({ contests: results,
