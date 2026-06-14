import axios from 'axios';
import * as cheerio from 'cheerio';

// ── href를 절대 URL로 안전하게 변환 (슬래시 누락 등 깨진 경로 방지) ────
function safeUrl(href, base) {
  if (!href) return '';
  try { return new URL(href, base).href; } catch { return ''; }
}

// ── 제목에서 카테고리 추정 ──────────────────────────────────────────
function guessCategory(title, extra = '') {
  const bracketLabels = [...title.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]).join(' ');
  const text = `${title} ${extra} ${bracketLabels}`;
  if (/슬로건|표어|캐치프레이즈|네이밍|명칭/.test(text)) return '슬로건';
  if (/사진|포토/.test(text))                        return '사진';
  if (/수기|수필|에세이/.test(text))                 return '수기';
  if (/아이디어|기획/.test(text))                    return '아이디어';
  if (/디자인|포스터|웹툰/.test(text))               return '디자인';
  if (/영상|동영상|UCC|유튜브|쇼츠/.test(text))     return '영상';
  return '기타';
}

// ── 제목에서 지역 추정 ─────────────────────────────────────────────
function guessRegion(title) {
  if (/대구|달서|수성|북구|동구|서구|남구|달성|중구/.test(title)) return '대구';
  return '';
}

// ── 제목에서 나이 제한 추정 ────────────────────────────────────────
function guessAge(title) {
  if (/초등/.test(title))                    return '초등학생';
  if (/중학|중고생/.test(title))             return '중학생';
  if (/청소년/.test(title))                  return '청소년';
  if (/대학생/.test(title))                  return '대학생';
  if (/일반|성인|전국민|누구나/.test(title)) return '성인';
  return '누구나';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청 방법이에요.' });

  const { sites = [] } = req.body;
  const results    = [];
  const siteStatus = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9',
  };

  for (const site of sites) {
    try {
      let contests = [];

      // ── 위비티 ──────────────────────────────────────────────────
      if (site.id === 'wevity') {
        const { data } = await axios.get('https://www.wevity.com/?c=find&s=1&gub=1', { headers, timeout: 12000 });
        const $ = cheerio.load(data);

        // 1순위: 다양한 셀렉터 순차 시도
        const selectors = [
          'ul.cid-list > li',
          '.list-wrap li',
          '.bd-list li',
          'ul.list > li',
          '.contest_list li',
          'li.item',
        ];
        for (const sel of selectors) {
          if (contests.length > 0) break;
          $(sel).each((_, el) => {
            const title = $(el).find('strong, .tit, .title, h4, h3, b').first().text().trim()
                       || $(el).find('a').first().text().trim();
            const host     = $(el).find('.host, .company, .organ, .org').first().text().trim();
            const deadline = $(el).find('.date, .dday, .d-day, .period').first().text().trim();
            const prize    = $(el).find('.prize, .reward, .money').first().text().trim();
            const href     = $(el).find('a').first().attr('href');
            const detailUrl = safeUrl(href, 'https://www.wevity.com/');
            if (title && title.length > 4) {
              contests.push({ title, host, deadline, prize, source: '위비티', detailUrl,
                region: guessRegion(title), category: guessCategory(title), ageTarget: guessAge(title) });
            }
          });
        }

        // 2순위 폴백: idx 링크
        if (!contests.length) {
          const seen = new Set();
          $('a[href*="idx"]').each((_, el) => {
            const title = $(el).text().trim();
            const href  = $(el).attr('href');
            if (title.length > 4 && title.length < 100 && !seen.has(title)) {
              seen.add(title);
              const detailUrl = safeUrl(href, 'https://www.wevity.com/');
              contests.push({ title, host: '', deadline: '', prize: '', source: '위비티', detailUrl,
                region: guessRegion(title), category: guessCategory(title), ageTarget: guessAge(title) });
            }
          });
        }

      // ── 콘테스트코리아 ──────────────────────────────────────────
      } else if (site.id === 'contest') {

        // 1순위: RSS 피드 (정적, JS 렌더링 불필요)
        let rssOk = false;
        try {
          const { data: rssData } = await axios.get(
            'https://www.contestkorea.com/rss/rssView.php?int_gbn=1',
            { headers, timeout: 12000 }
          );
          const $r = cheerio.load(rssData, { xmlMode: true });
          $r('item').each((_, el) => {
            const title = $r(el).find('title').text().trim();
            const link  = $r(el).find('link').text().trim();
            const desc  = $r(el).find('description').text().trim();
            const hostMatch = desc.match(/주최[^：:]*[：:]\s*([^|<\n]+)/);
            const dateMatch = desc.match(/마감[^：:]*[：:]\s*([^|<\n]+)/);
            const catMatch  = title.match(/^\s*\[([^\]]+)\]/) || desc.match(/\[([^\]]+)\]/);
            const catHint   = catMatch ? catMatch[1] : '';
            if (title && title.length > 4) {
              contests.push({
                title,
                host:      hostMatch ? hostMatch[1].trim() : '',
                deadline:  dateMatch ? dateMatch[1].trim() : '',
                prize:     '',
                source:    '콘테스트코리아',
                detailUrl: link || '',
                region:    guessRegion(title),
                category:  guessCategory(title, catHint),
                ageTarget: guessAge(title),
              });
            }
          });
          rssOk = contests.length > 0;
        } catch (_) { /* RSS 실패 시 폴백으로 */ }

        // 추가: 네이밍•슬로건 카테고리 전용 목록 (제목에 키워드 없어도 강제로 '슬로건' 분류)
        try {
          const { data: namingData } = await axios.get(
            'https://www.contestkorea.com/sub/list.php?int_gbn=1&Txt_bcode=030210001',
            { headers, timeout: 12000 }
          );
          const $n = cheerio.load(namingData);
          const existingTitles = new Set(contests.map(c => c.title));
          const seenNaming = new Set();
          $n('a[href*="Txt_bcode=030210001"][href*="str_no="]').each((_, el) => {
            let title = $n(el).text().replace(/\s+/g, ' ').trim();
            title = title.replace(/^네이밍\s*[•·]\s*슬로건\s*/, '').trim();
            const href = $n(el).attr('href');
            if (title.length > 5 && title.length < 100 && !seenNaming.has(title) && !existingTitles.has(title)) {
              seenNaming.add(title);
              const detailUrl = safeUrl(href, 'https://www.contestkorea.com/sub/list.php?int_gbn=1&Txt_bcode=030210001');

              // 같은 행(row)에서 D-day 또는 접수기간 정보 추출
              let deadline = '';
              const $row = $n(el).closest('tr, li, .item, .list-item');
              if ($row.length) {
                const rowText = $row.text().replace(/\s+/g, ' ');
                const ddayMatch = rowText.match(/D-\d+|D-DAY|마감임박|마감/i);
                if (ddayMatch) deadline = ddayMatch[0].toUpperCase();
                if (!deadline) {
                  const dateMatch = rowText.match(/\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\s*~\s*\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/);
                  if (dateMatch) deadline = dateMatch[0];
                }
              }

              contests.push({
                title, host: '', deadline, prize: '',
                source: '콘테스트코리아', detailUrl,
                region:    guessRegion(title),
                category:  '슬로건',
                ageTarget: guessAge(title),
              });
            }
          });
        } catch (_) { /* 무시 */ }

        // 2순위 폴백: 목록 페이지 링크 (RSS 실패 시에만)
        if (!rssOk) {
          const { data } = await axios.get(
            'https://www.contestkorea.com/sub/list.php?int_gbn=1',
            { headers, timeout: 12000 }
          );
          const $ = cheerio.load(data);
          const seen = new Set();
          $('a[href*="egoread"], a[href*="seq="]').each((_, el) => {
            const title = $(el).text().trim();
            const href  = $(el).attr('href');
            if (title.length > 5 && title.length < 100 && !seen.has(title)) {
              seen.add(title);
              const detailUrl = safeUrl(href, 'https://www.contestkorea.com/sub/list.php?int_gbn=1');
              contests.push({ title, host: '', deadline: '', prize: '', source: '콘테스트코리아', detailUrl,
                region: guessRegion(title), category: guessCategory(title), ageTarget: guessAge(title) });
            }
          });
        }
        contests = contests.slice(0, 30);

      // ── 씽굿 ────────────────────────────────────────────────────
      } else if (site.id === 'thinkgood') {
        const thinkUrls = [
          'https://www.thinkcontest.com/thinkgood/user/contest/index.do',
          'https://www.thinkcontest.com/Contest/list.html',
        ];
        for (const url of thinkUrls) {
          if (contests.length > 0) break;
          try {
            const { data } = await axios.get(url, { headers, timeout: 12000 });
            const $ = cheerio.load(data);
            const seen = new Set();

            const selectors = [
              '.contest_list li', '.list_bx li', 'ul.board_list li',
              '.bd-list li', 'li.item', 'tr.contest-row',
            ];
            for (const sel of selectors) {
              if (contests.length > 0) break;
              $(sel).each((_, el) => {
                const title = $(el).find('.tit, .title, strong, b, h4').first().text().trim()
                           || $(el).find('a').first().text().trim();
                const host     = $(el).find('.organ, .host, .name, .company').first().text().trim();
                const deadline = $(el).find('.date, .dday, .period').first().text().trim();
                const href     = $(el).find('a').first().attr('href');
                const detailUrl = safeUrl(href, url);
                if (title && title.length > 4 && !seen.has(title)) {
                  seen.add(title);
                  contests.push({ title, host, deadline, prize: '', source: '씽굿', detailUrl,
                    region: guessRegion(title), category: guessCategory(title), ageTarget: guessAge(title) });
                }
              });
            }

            // 모든 셀렉터 실패 시 링크 폴백
            if (!contests.length) {
              $('a[href*="contest"], a[href*="Contest"]').each((_, el) => {
                const title = $(el).text().trim();
                const href  = $(el).attr('href');
                if (title.length > 5 && title.length < 100 && !seen.has(title)) {
                  seen.add(title);
                  const detailUrl = safeUrl(href, url);
                  contests.push({ title, host: '', deadline: '', prize: '', source: '씽굿', detailUrl,
                    region: guessRegion(title), category: guessCategory(title), ageTarget: guessAge(title) });
                }
              });
            }
          } catch { /* URL 실패 시 다음 시도 */ }
        }

      // ── 직접 추가 사이트 ────────────────────────────────────────
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
            const detailUrl = safeUrl(href, site.url);
            contests.push({ title, host: '', deadline: '', prize: '', source: site.name, detailUrl,
              region: guessRegion(title), category: guessCategory(title), ageTarget: guessAge(title) });
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

  res.json({ contests: results, siteStatus });
}
