import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청 방법이에요.' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL이 없어요.' });

  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      timeout: 12000,
    });

    const $ = cheerio.load(data);

    // ── 광고/메뉴/스크립트 등 노이즈 제거 (Cheerio 전처리) ───────────────
    $(
      'script, style, noscript, iframe, form, ' +
      'nav, footer, header, aside, ' +
      '.ad, .ads, .adv, .advertise, .banner, .banner_area, ' +
      '.sns, .share, .sharing, ' +
      '.gnb, .lnb, .menu, .nav, .navbar, .breadcrumb, ' +
      '.popup, .modal, .layer, ' +
      '.comment, .comments, .reply, ' +
      '.related, .recommend, .ranking, .sidebar'
    ).remove();

    // ── 본문으로 추정되는 영역을 우선 사용 (없으면 body 전체) ───────────
    const contentSelectors = [
      '.view_cont', '.view-cont', '.board_view', '.board-view',
      '.detail_cont', '.detail-cont', '.content_view', '.content-view',
      '.view_area', '.view-area', '.cont_view',
      'article', '#content', '.content', '.view-content', 'main',
    ];
    let $content = null;
    for (const sel of contentSelectors) {
      const $el = $(sel).first();
      if ($el.length && $el.text().replace(/\s+/g, ' ').trim().length > 100) {
        $content = $el;
        break;
      }
    }

    const bodyText = ($content || $('body')).text().replace(/\s+/g, ' ').trim();
    const pageText = bodyText.slice(0, 3000);

    const charLimitMatch = pageText.match(/([0-9,]+)\s*자\s*(이내|이하|미만|내외)/);
    const charLimit      = charLimitMatch ? charLimitMatch[0] : '';

    const dateMatches = pageText.match(/[0-9]{4}[.\-\/][0-9]{1,2}[.\-\/][0-9]{1,2}/g);
    const resultDate  = dateMatches && dateMatches.length > 1
      ? dateMatches[dateMatches.length - 1].replace(/[\/\.]/g, '-')
      : '';

    const prizeMatch = pageText.match(/(대상|최우수|우수|장려)[^\n]{0,40}?([0-9,]+)\s*원/);
    const prize      = prizeMatch ? prizeMatch[0].slice(0, 50) : '';

    const targetMatch = pageText.match(/(응모\s*대상|참가\s*자격|신청\s*자격)[^\n]{0,60}/);
    const target      = targetMatch ? targetMatch[0].replace(/(응모\s*대상|참가\s*자격|신청\s*자격)/, '').trim().slice(0, 50) : '';

    const requireMatch = pageText.match(/(응모\s*조건|참가\s*조건|주제)[^\n]{0,80}/);
    const requirement  = requireMatch ? requireMatch[0].slice(0, 80) : '';

    const submitMatch  = pageText.match(/(제출|접수|신청)\s*(방법|경로)[^\n]{0,60}/);
    const submitMethod = submitMatch ? submitMatch[0].slice(0, 60) : '';

    let category = '기타';
    if (/슬로건|표어|캐치프레이즈/.test(pageText))        category = '슬로건';
    else if (/사진|포토|photo/i.test(pageText))            category = '사진';
    else if (/수기|수필|에세이|essay/i.test(pageText))     category = '수기';
    else if (/아이디어|공모|idea/i.test(pageText))         category = '아이디어';
    else if (/디자인|design|포스터/i.test(pageText))       category = '디자인';
    else if (/영상|동영상|video|유튜브/i.test(pageText))   category = '영상';

    res.json({ pageText, charLimit, resultDate, prize, target, requirement, submitMethod, category });
  } catch (e) {
    res.status(500).json({ error: '페이지 스크래핑에 실패했어요: ' + e.message });
  }
}
