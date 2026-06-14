import { useState, useEffect, useMemo } from 'react';

const DEFAULT_SITES = [
  { id: 'wevity',    name: '위비티',        url: 'https://www.wevity.com',        active: true },
  { id: 'contest',   name: '콘테스트코리아', url: 'https://www.contestkorea.com', active: true },
  { id: 'thinkgood', name: '씽굿',           url: 'https://www.thinkcontest.com', active: true },
];

const EMPTY_PROFILE = { label: '', name: '', age: '', region: '', job: '', interest: '' };
const CATEGORIES    = ['전체', '슬로건', '사진', '수기', '아이디어', '디자인', '영상', '기타'];
const AGE_TARGETS   = ['전체', '누구나', '초등학생', '중학생', '성인'];

// ── 마감까지 남은 일수 계산 (없으면 null=진행중, 마감된 건 음수) ───────
function getDaysLeft(deadline, refDate) {
  if (!deadline) return null;
  const today = refDate ? new Date(refDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const dMatch = deadline.match(/D-(\d+)/i);
  if (dMatch) return parseInt(dMatch[1], 10);
  if (/D-0\b|D-DAY|D0\b/i.test(deadline)) return 0;
  if (/접수예정/.test(deadline)) return null;        // 아직 시작 전 → 진행중으로 취급
  if (/^\s*마감\s*$/.test(deadline) || /마감(?!임박|예정)/.test(deadline)) return -1; // 이미 마감

  const full = deadline.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (full) {
    const d = new Date(parseInt(full[1], 10), parseInt(full[2], 10) - 1, parseInt(full[3], 10));
    return Math.ceil((d - today) / 86400000);
  }
  const short = deadline.match(/(\d{1,2})[.\/-](\d{1,2})/);
  if (short) {
    let d = new Date(today.getFullYear(), parseInt(short[1], 10) - 1, parseInt(short[2], 10));
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return Math.ceil((d - today) / 86400000);
  }
  return null; // 형식 불명 → 진행중으로 취급
}

// ── 다양한 날짜 표기(YYYY.MM.DD, YY-MM-DD 등)를 Date로 변환 ────────────
function parseFlexDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{2,4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (!m) return null;
  let y = parseInt(m[1], 10);
  if (y < 100) y += 2000;
  const d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(dateStr) {
  const target = parseFlexDate(dateStr);
  if (!target) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

const catColor = {
  '슬로건': '#7c3aed', '사진': '#0891b2', '수기': '#059669',
  '아이디어': '#d97706', '디자인': '#e11d48', '영상': '#1d4ed8', '기타': '#6b7280',
};
const statusColor = { '응모 완료': '#059669', '당첨': '#d97706', '미당첨': '#6b7280', '확인 중': '#1d4ed8' };

const S = {
  wrap:   { maxWidth: '760px', margin: '0 auto', padding: '16px', fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif', background: '#f4f6fb', minHeight: '100vh' },
  hdr:    { background: 'linear-gradient(135deg,#1d4ed8 0%,#4338ca 100%)', color: '#fff', borderRadius: '16px', padding: '22px 24px', marginBottom: '16px' },
  tabs:   { display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' },
  tab:    a => ({ padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: a ? '700' : '400', background: a ? '#1d4ed8' : '#fff', color: a ? '#fff' : '#6b7280', boxShadow: a ? '0 2px 8px rgba(29,78,216,0.18)' : 'none', transition: 'all .15s' }),
  card:   { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '18px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  btn:    (bg, sm) => ({ background: bg, color: '#fff', border: 'none', padding: sm ? '6px 12px' : '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: sm ? '13px' : '14px', fontWeight: '600', transition: 'filter .1s' }),
  btnOut: (color, sm) => ({ background: '#fff', color, border: `1.5px solid ${color}`, padding: sm ? '5px 11px' : '8px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: sm ? '13px' : '14px', fontWeight: '600' }),
  input:  { width: '100%', border: '1px solid #d1d5db', borderRadius: '9px', padding: '9px 12px', fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box', background: '#fff' },
  lbl:    { fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' },
  badge:  color => ({ display: 'inline-block', padding: '3px 9px', borderRadius: '12px', fontSize: '12px', background: color + '18', color, fontWeight: '600', marginRight: '6px' }),
  pill:   (bg, fg) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: '99px', fontSize: '12px', background: bg, color: fg, fontWeight: '600', marginRight: '4px' }),
  row:    { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  stat:   { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 18px', textAlign: 'center', flex: '1' },
  filterBtn: (active) => ({
    padding: '5px 12px', borderRadius: '20px', border: active ? 'none' : '1px solid #d1d5db',
    cursor: 'pointer', fontSize: '13px', fontWeight: active ? '700' : '400',
    background: active ? '#1d4ed8' : '#fff', color: active ? '#fff' : '#6b7280',
    transition: 'all .15s',
  }),
};

export default function Home() {
  const [tab, setTab]                       = useState('search');
  const [contests, setContests]             = useState([]);
  const [loading, setLoading]               = useState(false);
  const [siteStatus, setSiteStatus]         = useState([]);
  const [detail, setDetail]                 = useState({});
  const [detailLoading, setDetailLoading]   = useState({});
  const [results, setResults]               = useState({});
  const [genLoading, setGenLoading]         = useState({});
  const [copied, setCopied]                 = useState({});
  const [viewMode, setViewMode]             = useState('urgent'); // 'urgent' | 'ongoing' | 'prize'
  const [searchTime, setSearchTime]         = useState(null);
  const [regionFilter, setRegionFilter]     = useState('전체');  // '전체' | '전국' | '대구'
  const [catFilter, setCatFilter]           = useState('전체');
  const [ageFilter, setAgeFilter]           = useState('전체');
  const [keyword, setKeyword]               = useState('');
  const [history, setHistory]               = useState([]);
  const [bookmarks, setBookmarks]           = useState([]);
  const [profiles, setProfiles]             = useState([
    { ...EMPTY_PROFILE, label: '프로필 1' },
    { ...EMPTY_PROFILE, label: '프로필 2' },
    { ...EMPTY_PROFILE, label: '프로필 3' },
    { ...EMPTY_PROFILE, label: '프로필 4' },
  ]);
  const [activeProfile, setActiveProfile]   = useState(0);
  const [editingProfile, setEditingProfile] = useState(0);
  const [sites, setSites]                   = useState(DEFAULT_SITES);
  const [newSiteName, setNewSiteName]       = useState('');
  const [newSiteUrl, setNewSiteUrl]         = useState('');
  const [genCount, setGenCount]             = useState(5);
  const [statsView, setStatsView]           = useState(false);

  useEffect(() => {
    try {
      const p = localStorage.getItem('v5_profiles');
      const h = localStorage.getItem('v5_history');
      const s = localStorage.getItem('v5_sites');
      const b = localStorage.getItem('v5_bookmarks');
      if (p) setProfiles(JSON.parse(p));
      if (h) setHistory(JSON.parse(h));
      if (s) setSites(JSON.parse(s));
      if (b) setBookmarks(JSON.parse(b));
    } catch {}
  }, []);

  useEffect(() => { try { localStorage.setItem('v5_profiles',  JSON.stringify(profiles));  } catch {} }, [profiles]);
  useEffect(() => { try { localStorage.setItem('v5_history',   JSON.stringify(history));   } catch {} }, [history]);
  useEffect(() => { try { localStorage.setItem('v5_sites',     JSON.stringify(sites));     } catch {} }, [sites]);
  useEffect(() => { try { localStorage.setItem('v5_bookmarks', JSON.stringify(bookmarks)); } catch {} }, [bookmarks]);

  // ── 복사 + 피드백 ────────────────────────────────────────────────────
  const copyWithFeedback = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(p => ({ ...p, [key]: true }));
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000);
  };

  // ── 공모전 검색 ──────────────────────────────────────────────────────
  const fetchContests = async () => {
    setLoading(true); setContests([]); setSiteStatus([]); setDetail({}); setResults({});
    setSearchTime(new Date());
    try {
      const activeSites = sites.filter(s => s.active).map(s => ({ id: s.id, name: s.name, url: s.url }));
      const res  = await fetch('/api/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites: activeSites }),
      });
      const data = await res.json();
      setContests(data.contests || []);
      setSiteStatus(data.siteStatus || []);
    } catch { alert('검색에 실패했어요. 잠시 후 다시 시도해주세요.'); }
    setLoading(false);
  };

  // ── 상세 스크래핑 ────────────────────────────────────────────────────
  const fetchDetail = async (contest, idx) => {
    if (!contest.detailUrl) return alert('상세 페이지 URL을 찾을 수 없어요.');
    setDetailLoading(p => ({ ...p, [idx]: true }));
    try {
      const res  = await fetch('/api/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: contest.detailUrl }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || '스크래핑 오류'); }
      const data = await res.json();
      setDetail(p => ({ ...p, [idx]: data }));
    } catch (e) { alert(e.message || '상세 분석에 실패했어요.'); }
    setDetailLoading(p => ({ ...p, [idx]: false }));
  };

  // ── 프롬프트 생성 ─────────────────────────────────────────────────────
  const generate = async (contest, idx) => {
    setGenLoading(p => ({ ...p, [idx]: true }));
    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contest, profile: profiles[activeProfile], detailInfo: detail[idx] || null, count: genCount }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || '생성 오류'); }
      const data = await res.json();
      setResults(p => ({ ...p, [idx]: { prompt: data.prompt, response: '' } }));
    } catch (e) { alert(e.message || '프롬프트 생성에 실패했어요.'); }
    setGenLoading(p => ({ ...p, [idx]: false }));
  };

  // ── 히스토리 저장 ────────────────────────────────────────────────────
  const saveToHistory = (contest, idx) => {
    const r = results[idx];
    if (!r?.response?.trim()) return alert('STEP 2에 Claude 응답을 먼저 붙여넣어주세요.');
    setHistory(h => [{
      id:           Date.now(),
      contestTitle: contest.title,
      host:         contest.host || '',
      siteUrl:      contest.detailUrl || '',
      sourceName:   contest.source || '',
      resultDate:   detail[idx]?.resultDate || '',
      deadline:     contest.deadline || '',
      category:     detail[idx]?.category || contest.category || '',
      prompt:       r.prompt,
      result:       r.response,
      profile:      profiles[activeProfile].name || profiles[activeProfile].label || `프로필 ${activeProfile + 1}`,
      date:         new Date().toLocaleDateString('ko-KR'),
      status:       '응모 완료',
    }, ...h].slice(0, 100));
    alert('✅ 히스토리에 저장됐어요!');
  };

  // ── 히스토리에서 프롬프트 재생성 ─────────────────────────────────────
  const regenerate = async (hItem) => {
    const fake    = { title: hItem.contestTitle, host: hItem.host, deadline: hItem.deadline, source: hItem.sourceName, detailUrl: hItem.siteUrl, category: hItem.category };
    const profile = profiles.find(p => (p.name || p.label) === hItem.profile) || profiles[activeProfile];
    setGenLoading(p => ({ ...p, ['h_' + hItem.id]: true }));
    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contest: fake, profile, detailInfo: null, count: genCount }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || '재생성 오류'); }
      const data = await res.json();
      await navigator.clipboard.writeText(data.prompt);
      alert('📋 새 프롬프트가 클립보드에 복사됐어요!\nClaude.ai에 붙여넣어 새 응모글을 받으세요.');
    } catch (e) { alert(e.message || '재생성에 실패했어요.'); }
    setGenLoading(p => ({ ...p, ['h_' + hItem.id]: false }));
  };

  // ── 즐겨찾기 ─────────────────────────────────────────────────────────
  const toggleBookmark = (contest) => {
    setBookmarks(b => {
      const exists = b.find(x => x.title === contest.title);
      if (exists) return b.filter(x => x.title !== contest.title);
      return [{ ...contest, savedAt: new Date().toLocaleDateString('ko-KR') }, ...b].slice(0, 50);
    });
  };
  const isBookmarked = (title) => bookmarks.some(b => b.title === title);

  const updateHistoryStatus = (id, status) =>
    setHistory(h => h.map(item => item.id === id ? { ...item, status } : item));

  const toggleSite  = id => setSites(s => s.map(x => x.id === id ? { ...x, active: !x.active } : x));
  const removeSite  = id => setSites(s => s.filter(x => x.id !== id));
  const addSite = () => {
    if (!newSiteName || !newSiteUrl) return alert('이름과 URL 모두 입력하세요.');
    const url = newSiteUrl.startsWith('http') ? newSiteUrl : 'https://' + newSiteUrl;
    setSites(s => [...s, { id: Date.now().toString(), name: newSiteName, url, active: true }]);
    setNewSiteName(''); setNewSiteUrl('');
  };
  const updateProfile = (idx, field, value) =>
    setProfiles(p => p.map((pr, i) => i === idx ? { ...pr, [field]: value } : pr));

  // ── 정렬·필터 ─────────────────────────────────────────────────────────
  const appliedTitles = useMemo(() => new Set(history.map(h => h.contestTitle)), [history]);

  const sorted = useMemo(() => {
    const refTime = searchTime || new Date();

    // 제목 기준 중복 제거 (먼저 나온 것만 유지)
    const seenTitles = new Set();
    const deduped = contests.filter(c => {
      const key = (c.title || '').trim();
      if (!key || seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });

    return deduped
      .filter(c => {
        // 이미 응모한 공모전은 검색 결과에서 제외
        if (appliedTitles.has(c.title)) return false;

        const text = (c.title + (c.host || '') + (c.region || '')).toLowerCase();
        // 키워드 검색
        if (keyword && !text.includes(keyword.toLowerCase())) return false;
        // 카테고리 필터
        if (catFilter !== '전체' && (c.category || '기타') !== catFilter) return false;
        // 지역 필터
        if (regionFilter === '대구' && c.region !== '대구') return false;
        if (regionFilter === '전국' && c.region === '대구') return false;
        // 나이 필터
        if (ageFilter !== '전체' && (c.ageTarget || '누구나') !== ageFilter) return false;

        // 검색 시점 기준 남은 일수
        const daysLeft = getDaysLeft(c.deadline, refTime);

        // 이미 마감된 공모전은 항상 제외
        if (daysLeft !== null && daysLeft < 0) return false;

        if (viewMode === 'urgent')  return daysLeft !== null && daysLeft <= 7;   // 마감임박순: 7일 이내
        if (viewMode === 'ongoing') return daysLeft === null || daysLeft > 7;    // 진행중: 나머지
        return true; // 상금높은순: 마감 제외 전체
      })
      .sort((a, b) => {
        if (viewMode === 'prize') {
          const pa = parseInt(a.prize?.replace(/[^0-9]/g, '') || '0', 10);
          const pb = parseInt(b.prize?.replace(/[^0-9]/g, '') || '0', 10);
          if (pb !== pa) return pb - pa;
        }
        const da = getDaysLeft(a.deadline, refTime);
        const db = getDaysLeft(b.deadline, refTime);
        const sa = da === null ? 9999 : da;
        const sb = db === null ? 9999 : db;
        return sa - sb;
      });
  }, [contests, keyword, regionFilter, catFilter, ageFilter, viewMode, searchTime, appliedTitles]);

  // ── 히스토리: 결과발표일 최신순 정렬 ──────────────────────────────────
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const da = parseFlexDate(a.resultDate);
      const db = parseFlexDate(b.resultDate);
      if (da && db) return db - da;       // 결과발표일이 최신(늦은 날짜)인 것부터
      if (da) return -1;
      if (db) return 1;
      return b.id - a.id;                 // 결과발표일 없으면 최근 응모순
    });
  }, [history]);

  // ── 통계 ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = history.length;
    const won     = history.filter(h => h.status === '당첨').length;
    const lost    = history.filter(h => h.status === '미당첨').length;
    const pending = history.filter(h => h.status === '확인 중' || h.status === '응모 완료').length;
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
    return { total, won, lost, pending, winRate };
  }, [history]);

  // ── 렌더 ──────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>

      {/* 헤더 */}
      <div style={S.hdr}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>🏆 AI 공모전 응모글 자동 생성기</div>
            <div style={{ fontSize: '13px', opacity: .85 }}>프롬프트 생성 → Claude.ai 붙여넣기 → 응답 저장 → 히스토리 관리</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '10px', padding: '6px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '700' }}>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>v6</div>
          </div>
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', opacity: .8 }}>
          <span>👤 {profiles[activeProfile].name || profiles[activeProfile].label || `프로필 ${activeProfile + 1}`}</span>
          <span>🌐 {sites.filter(s => s.active).length}개 사이트</span>
          <span>📋 응모 {stats.total}건</span>
          {stats.won > 0 && <span>🏅 당첨 {stats.won}건 ({stats.winRate}%)</span>}
        </div>
      </div>

      {/* 탭 */}
      <div style={S.tabs}>
        {[['search','🔍 공모전'],['bookmarks','⭐ 즐겨찾기'],['history','📋 히스토리'],['profile','👤 프로필'],['sites','🌐 사이트']].map(([k, l]) => (
          <button key={k} style={S.tab(tab === k)} onClick={() => setTab(k)}>
            {l}
            {k === 'bookmarks' && bookmarks.length > 0 && (
              <span style={{ marginLeft: '4px', background: '#fbbf24', color: '#fff', borderRadius: '99px', padding: '1px 6px', fontSize: '11px' }}>{bookmarks.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────── 검색 탭 ─────────── */}
      {tab === 'search' && (
        <div>
          <div style={{ ...S.card, padding: '14px 16px' }}>

            {/* 검색 버튼 + 프로필 */}
            <div style={{ ...S.row, marginBottom: '10px' }}>
              <button onClick={fetchContests} disabled={loading} style={S.btn(loading ? '#9ca3af' : '#1d4ed8')}>
                {loading ? '⏳ 검색 중...' : '🔍 공모전 자동 검색'}
              </button>
              <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                프로필:
                <select value={activeProfile} onChange={e => setActiveProfile(Number(e.target.value))}
                  style={{ border: '1px solid #d1d5db', borderRadius: '7px', padding: '4px 8px', fontSize: '13px', background: '#fff' }}>
                  {profiles.map((p, i) => <option key={i} value={i}>{p.name || p.label || `프로필 ${i+1}`}</option>)}
                </select>
              </div>
            </div>

            {/* 보기 모드: 마감임박순 / 진행중 / 상금높은순 (가로 스크롤) */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
              {[
                ['urgent',  '⏰ 마감임박순'],
                ['ongoing', '🟢 진행중'],
                ['prize',   '💰 상금높은순'],
              ].map(([k, l]) => (
                <button key={k} onClick={() => setViewMode(k)}
                  style={{ ...S.filterBtn(viewMode === k), whiteSpace: 'nowrap', flexShrink: 0, padding: '7px 16px' }}>
                  {l}
                </button>
              ))}
            </div>
            {viewMode === 'urgent' && (
              <div style={{ fontSize: '12px', color: '#d97706', marginBottom: '8px' }}>
                ⏰ 검색 시점 기준 마감까지 7일 이내인 공모전만 보여줘요.
              </div>
            )}
            {viewMode === 'ongoing' && (
              <div style={{ fontSize: '12px', color: '#059669', marginBottom: '8px' }}>
                🟢 마감까지 8일 이상 남았거나 마감일이 정해지지 않은 공모전을 보여줘요.
              </div>
            )}

            {/* 키워드 검색 */}
            <input placeholder="🔎 키워드 검색 (공모전명·주최·지역)" value={keyword} onChange={e => setKeyword(e.target.value)}
              style={{ ...S.input, marginBottom: '10px' }} />

            {/* 지역 필터 */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '8px', fontWeight: '600' }}>📍 지역</span>
              {['전체', '전국', '대구'].map(r => (
                <button key={r} onClick={() => setRegionFilter(r)} style={{ ...S.filterBtn(regionFilter === r), marginRight: '6px' }}>
                  {r}
                </button>
              ))}
            </div>

            {/* 카테고리 필터 */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '8px', fontWeight: '600' }}>📂 유형</span>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ ...S.filterBtn(catFilter === c), marginRight: '6px', marginBottom: '4px' }}>
                  {c}
                </button>
              ))}
            </div>

            {/* 나이 필터 */}
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '8px', fontWeight: '600' }}>👤 대상</span>
              {AGE_TARGETS.map(a => (
                <button key={a} onClick={() => setAgeFilter(a)} style={{ ...S.filterBtn(ageFilter === a), marginRight: '6px' }}>
                  {a}
                </button>
              ))}
            </div>

            {/* 생성 옵션 */}
            <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: '9px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#1d4ed8', fontWeight: '600' }}>✍️ 생성 옵션</span>
              <label style={{ fontSize: '13px', color: '#374151', display: 'flex', gap: '6px', alignItems: 'center' }}>
                응모글 수:
                <select value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                  style={{ border: '1px solid #d1d5db', borderRadius: '7px', padding: '3px 7px', fontSize: '13px', background: '#fff' }}>
                  {[3, 5, 7].map(n => <option key={n} value={n}>{n}개</option>)}
                </select>
              </label>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>✨ 문체는 공모전 내용에 맞게 자동 결정돼요</span>
            </div>
          </div>

          {/* 사이트 상태 */}
          {siteStatus.length > 0 && (
            <div style={{ ...S.card, padding: '10px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {siteStatus.map((s, i) => (
                <span key={i} style={{ fontSize: '13px', color: s.success ? '#059669' : '#ef4444' }}>
                  {s.success ? '✅' : '❌'} {s.name} ({s.count}건)
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#6b7280' }}>총 {sorted.length}건 표시</span>
            </div>
          )}

          {sorted.length === 0 && !loading && contests.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '48px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏆</div>
              위 버튼을 눌러 공모전을 검색하세요
            </div>
          )}
          {sorted.length === 0 && !loading && contests.length > 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>현재 필터 조건에 맞는 공모전이 없어요.</div>
          )}

          {/* 공모전 목록 */}
          {sorted.map((c, i) => (
            <div key={i} style={{ ...S.card, borderLeft: appliedTitles.has(c.title) ? '4px solid #059669' : '1.5px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  {/* 제목 클릭 → 사이트 이동 */}
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '7px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {c.detailUrl ? (
                      <a href={c.detailUrl} target="_blank" rel="noreferrer"
                        style={{ color: '#111827', textDecoration: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.target.style.color = '#1d4ed8'}
                        onMouseLeave={e => e.target.style.color = '#111827'}>
                        {c.title} 🔗
                      </a>
                    ) : (
                      <span style={{ color: '#111827' }}>{c.title}</span>
                    )}
                    {appliedTitles.has(c.title) && <span style={S.pill('#d1fae5', '#059669')}>응모완료</span>}
                    {isBookmarked(c.title)       && <span style={S.pill('#fef3c7', '#d97706')}>⭐ 저장됨</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {c.host      && <span style={S.badge('#6b7280')}>{c.host}</span>}
                    {c.deadline  && <span style={S.badge('#059669')}>{c.deadline}</span>}
                    {c.prize     && <span style={S.badge('#d97706')}>{c.prize}</span>}
                    {c.region    && <span style={S.badge('#1d4ed8')}>{c.region}</span>}
                    {c.ageTarget && c.ageTarget !== '누구나' && <span style={S.badge('#7c3aed')}>{c.ageTarget}</span>}
                    {c.category  && c.category !== '기타' && <span style={S.badge(catColor[c.category] || '#6b7280')}>{c.category}</span>}
                    {c.source    && <span style={{ fontSize: '12px', color: '#9ca3af' }}>출처: {c.source}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '116px' }}>
                  <button onClick={() => toggleBookmark(c)} style={S.btnOut(isBookmarked(c.title) ? '#d97706' : '#9ca3af', true)}>
                    {isBookmarked(c.title) ? '⭐ 저장됨' : '☆ 즐겨찾기'}
                  </button>
                  {c.detailUrl && (
                    <button onClick={() => fetchDetail(c, i)} disabled={detailLoading[i]}
                      style={S.btn(detailLoading[i] ? '#9ca3af' : '#7c3aed', true)}>
                      {detailLoading[i] ? '분석 중...' : '🔬 상세 분석'}
                    </button>
                  )}
                  <button onClick={() => generate(c, i)} disabled={genLoading[i]}
                    style={S.btn(genLoading[i] ? '#9ca3af' : '#059669', true)}>
                    {genLoading[i] ? '⏳ 생성 중...' : '✍️ 프롬프트 생성'}
                  </button>
                </div>
              </div>

              {/* 상세 분석 결과 */}
              {detail[i] && (
                <div style={{ marginTop: '12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontWeight: '700', color: '#7c3aed', marginBottom: '8px', fontSize: '13px' }}>🔬 상세 분석 결과 <span style={{ fontWeight: '400', color: '#9ca3af' }}>(원문 포함, 평가기준 자동 반영)</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px' }}>
                    {detail[i].charLimit    && <div><span style={{ color: '#6b7280' }}>글자 수: </span><strong>{detail[i].charLimit}</strong></div>}
                    {detail[i].resultDate   && <div><span style={{ color: '#6b7280' }}>결과 발표: </span><strong style={{ color: '#d97706' }}>{detail[i].resultDate}</strong></div>}
                    {detail[i].target       && <div><span style={{ color: '#6b7280' }}>응모 대상: </span><strong>{detail[i].target}</strong></div>}
                    {detail[i].prize        && <div><span style={{ color: '#6b7280' }}>시상: </span><strong>{detail[i].prize}</strong></div>}
                    {detail[i].category     && <div><span style={{ color: '#6b7280' }}>유형: </span><strong>{detail[i].category}</strong></div>}
                    {detail[i].submitMethod && <div><span style={{ color: '#6b7280' }}>제출: </span><strong>{detail[i].submitMethod}</strong></div>}
                  </div>
                </div>
              )}

              {/* STEP 1 + STEP 2 */}
              {results[i] && (
                <div style={{ marginTop: '12px' }}>

                  {/* STEP 1: 프롬프트 복사 */}
                  <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ fontWeight: '700', color: '#7c3aed', marginBottom: '8px', fontSize: '13px' }}>
                      📋 STEP 1 — 아래 프롬프트를 복사해서 Claude.ai에 붙여넣으세요
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#374151', margin: 0, lineHeight: '1.7', maxHeight: '180px', overflow: 'auto', background: '#fff', borderRadius: '8px', padding: '10px', border: '1px solid #e5e7eb' }}>
                      {results[i].prompt}
                    </pre>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={() => copyWithFeedback(results[i].prompt, 'p_' + i)}
                        style={S.btn(copied['p_' + i] ? '#059669' : '#7c3aed', true)}>
                        {copied['p_' + i] ? '✅ 복사됨!' : '📋 프롬프트 복사'}
                      </button>
                      <a href="https://claude.ai" target="_blank" rel="noreferrer"
                        style={{ ...S.btn('#1d4ed8', true), textDecoration: 'none' }}>
                        💬 Claude.ai 열기
                      </a>
                    </div>
                  </div>

                  {/* STEP 2: Claude 응답 붙여넣기 */}
                  <div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontWeight: '700', color: '#1d4ed8', marginBottom: '8px', fontSize: '13px' }}>
                      ✍️ STEP 2 — Claude에서 받은 응모글을 여기에 붙여넣기
                    </div>
                    <textarea
                      value={results[i].response}
                      onChange={e => setResults(p => ({ ...p, [i]: { ...p[i], response: e.target.value } }))}
                      placeholder="Claude.ai에서 받은 응모글 전체를 여기에 붙여넣으세요..."
                      style={{ width: '100%', minHeight: '160px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px', fontSize: '13px', lineHeight: '1.7', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}
                    />
                    {results[i].response && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => copyWithFeedback(results[i].response, 'r_' + i)}
                          style={S.btn(copied['r_' + i] ? '#059669' : '#1d4ed8', true)}>
                          {copied['r_' + i] ? '✅ 복사됨!' : '📋 응모글 복사'}
                        </button>
                        <button onClick={() => saveToHistory(c, i)} style={S.btn('#059669', true)}>
                          💾 히스토리 저장
                        </button>
                        {c.detailUrl && (
                          <a href={c.detailUrl} target="_blank" rel="noreferrer"
                            style={{ ...S.btn('#d97706', true), textDecoration: 'none' }}>
                            🔗 공모전 이동
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─────────── 즐겨찾기 탭 ─────────── */}
      {tab === 'bookmarks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>⭐ 즐겨찾기 ({bookmarks.length}건)</div>
            {bookmarks.length > 0 && (
              <button onClick={() => { if (confirm('전체 삭제할까요?')) setBookmarks([]); }} style={S.btn('#ef4444', true)}>전체 삭제</button>
            )}
          </div>
          {bookmarks.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '48px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⭐</div>
              공모전 목록에서 ☆ 즐겨찾기 버튼을 눌러 저장하세요
            </div>
          )}
          {bookmarks.map((c, i) => (
            <div key={i} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                    {c.detailUrl ? (
                      <a href={c.detailUrl} target="_blank" rel="noreferrer" style={{ color: '#111827', textDecoration: 'none' }}>
                        {c.title} 🔗
                      </a>
                    ) : c.title}
                  </div>
                  <div>
                    {c.host     && <span style={S.badge('#6b7280')}>{c.host}</span>}
                    {c.deadline && <span style={S.badge('#059669')}>{c.deadline}</span>}
                    {c.prize    && <span style={S.badge('#d97706')}>{c.prize}</span>}
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>저장: {c.savedAt}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button onClick={() => toggleBookmark(c)} style={S.btnOut('#ef4444', true)}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────── 히스토리 탭 ─────────── */}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={S.tab(!statsView)} onClick={() => setStatsView(false)}>📋 목록</button>
              <button style={S.tab(statsView)}  onClick={() => setStatsView(true)}>📊 통계</button>
            </div>
            {history.length > 0 && (
              <button onClick={() => { if (confirm('전체 삭제할까요?')) setHistory([]); }} style={S.btn('#ef4444', true)}>전체 삭제</button>
            )}
          </div>

          {/* 통계 뷰 */}
          {statsView && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={S.stat}><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>총 응모</div><div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8' }}>{stats.total}</div></div>
                <div style={S.stat}><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>당첨</div><div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706' }}>{stats.won}</div></div>
                <div style={S.stat}><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>미당첨</div><div style={{ fontSize: '24px', fontWeight: '800', color: '#6b7280' }}>{stats.lost}</div></div>
                <div style={S.stat}><div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>대기 중</div><div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>{stats.pending}</div></div>
              </div>
              <div style={{ ...S.card, display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>당첨률</div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: stats.winRate > 0 ? '#d97706' : '#9ca3af' }}>{stats.winRate}%</div>
                </div>
                <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '99px', height: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.winRate}%`, background: '#d97706', height: '100%', borderRadius: '99px', transition: 'width .5s' }} />
                </div>
              </div>
              <div style={S.card}>
                <div style={{ fontWeight: '700', marginBottom: '10px' }}>카테고리별 응모 현황</div>
                {(() => {
                  const m = {};
                  history.forEach(h => { const k = h.category || '기타'; m[k] = (m[k] || 0) + 1; });
                  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ ...S.badge(catColor[cat] || '#6b7280'), minWidth: '54px', textAlign: 'center' }}>{cat}</span>
                      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${(cnt / stats.total) * 100}%`, background: catColor[cat] || '#6b7280', height: '100%', borderRadius: '99px' }} />
                      </div>
                      <span style={{ fontSize: '13px', color: '#374151', minWidth: '24px', textAlign: 'right' }}>{cnt}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* 목록 뷰 */}
          {!statsView && (
            <div>
              {history.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '48px 0' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                  STEP 2에 응모글을 붙여넣고 💾 저장하면 여기에 기록돼요
                </div>
              )}
              {sortedHistory.map(h => {
                const daysLeft = daysUntil(h.resultDate);
                return (
                  <div key={h.id} style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827', flex: 1 }}>{h.contestTitle}</div>
                      <select value={h.status} onChange={e => updateHistoryStatus(h.id, e.target.value)}
                        style={{ border: `1.5px solid ${statusColor[h.status] || '#d1d5db'}`, borderRadius: '7px', padding: '4px 8px', fontSize: '13px', color: statusColor[h.status] || '#374151', background: '#fff', cursor: 'pointer' }}>
                        <option>응모 완료</option><option>확인 중</option><option>당첨</option><option>미당첨</option>
                      </select>
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      {h.host       && <span style={S.badge('#6b7280')}>{h.host}</span>}
                      {h.sourceName && <span style={S.badge('#1d4ed8')}>{h.sourceName}</span>}
                      {h.profile    && <span style={S.badge('#7c3aed')}>{h.profile}</span>}
                      {h.category   && <span style={S.badge(catColor[h.category] || '#6b7280')}>{h.category}</span>}
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>응모일: {h.date}</span>
                      {h.resultDate && (
                        <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: '800', marginLeft: '4px' }}>
                          📅 결과발표: {h.resultDate}
                          {daysLeft !== null && (
                            <span style={{ fontSize: '13px', marginLeft: '6px' }}>
                              ({daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? 'D-DAY' : '발표됨'})
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {h.siteUrl && (
                      <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                        <a href={h.siteUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none' }}>🔗 {h.siteUrl}</a>
                      </div>
                    )}

                    {h.result && (
                      <details>
                        <summary style={{ cursor: 'pointer', fontSize: '14px', color: '#059669', fontWeight: '600', userSelect: 'none', marginBottom: '2px' }}>응모글 보기 ▾</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#374151', marginTop: '8px', lineHeight: '1.75', background: '#f0fdf4', borderRadius: '8px', padding: '10px', maxHeight: '220px', overflow: 'auto' }}>{h.result}</pre>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button onClick={() => copyWithFeedback(h.result, 'hr_' + h.id)}
                            style={S.btn(copied['hr_' + h.id] ? '#059669' : '#1d4ed8', true)}>
                            {copied['hr_' + h.id] ? '✅ 복사됨!' : '📋 응모글 복사'}
                          </button>
                        </div>
                      </details>
                    )}

                    <details style={{ marginTop: h.result ? '8px' : '0' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#7c3aed', userSelect: 'none' }}>프롬프트 보기 ▾</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#374151', marginTop: '6px', lineHeight: '1.7', background: '#faf5ff', borderRadius: '8px', padding: '10px', maxHeight: '160px', overflow: 'auto' }}>{h.prompt}</pre>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => copyWithFeedback(h.prompt, 'hp_' + h.id)}
                          style={S.btn(copied['hp_' + h.id] ? '#059669' : '#7c3aed', true)}>
                          {copied['hp_' + h.id] ? '✅ 복사됨!' : '📋 프롬프트 복사'}
                        </button>
                        <button onClick={() => regenerate(h)} disabled={genLoading['h_' + h.id]}
                          style={S.btn(genLoading['h_' + h.id] ? '#9ca3af' : '#059669', true)}>
                          {genLoading['h_' + h.id] ? '생성 중...' : '🔄 프롬프트 재생성'}
                        </button>
                        <a href="https://claude.ai" target="_blank" rel="noreferrer"
                          style={{ ...S.btnOut('#1d4ed8', true), textDecoration: 'none' }}>
                          💬 Claude.ai
                        </a>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────── 프로필 탭 ─────────── */}
      {tab === 'profile' && (
        <div>
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#6b7280' }}>
            프로필 4개를 저장할 수 있어요. 가족·지인별로 등록하면 같은 공모전에 다양한 관점의 프롬프트를 만들 수 있어요.
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {profiles.map((p, i) => (
              <button key={i} style={{ ...S.tab(editingProfile === i), flex: 1 }} onClick={() => setEditingProfile(i)}>
                {p.name || p.label || `프로필 ${i+1}`}
              </button>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ fontWeight: '700', marginBottom: '14px', fontSize: '15px' }}>
              {profiles[editingProfile].name || profiles[editingProfile].label || `프로필 ${editingProfile+1}`} 편집
            </div>
            {[
              ['label',    '프로필 이름',      '예: 엄마, 나, 아빠'],
              ['name',     '실제 이름',         '예: 김민준'],
              ['age',      '나이대',             '예: 50대'],
              ['region',   '지역',               '예: 대구 달서구'],
              ['job',      '직업',               '예: 주부, 직장인'],
              ['interest', '관심사 / 단골 표현', '예: 건강, 가족 / 늘 응원합니다'],
            ].map(([field, label, ph]) => (
              <div key={field}>
                <span style={S.lbl}>{label}</span>
                <input style={S.input} placeholder={ph} value={profiles[editingProfile][field] || ''}
                  onChange={e => updateProfile(editingProfile, field, e.target.value)} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setActiveProfile(editingProfile)} style={S.btn('#1d4ed8')}>✅ 이 프로필 사용</button>
              <button onClick={() => setProfiles(p => p.map((pr, i) => i === editingProfile ? { ...EMPTY_PROFILE, label: `프로필 ${i+1}` } : pr))}
                style={S.btn('#9ca3af')}>초기화</button>
            </div>
            {activeProfile === editingProfile && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#059669', fontWeight: '600' }}>✅ 현재 선택된 프로필이에요</div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── 사이트 관리 탭 ─────────── */}
      {tab === 'sites' && (
        <div>
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#6b7280' }}>
            체크된 사이트만 검색해요. 원하는 공모전 사이트를 직접 추가할 수 있어요.
          </div>
          {sites.map(site => (
            <div key={site.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={site.active} onChange={() => toggleSite(site.id)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1d4ed8' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{site.name}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>{site.url}</div>
              </div>
              {!DEFAULT_SITES.find(d => d.id === site.id) && (
                <button onClick={() => removeSite(site.id)}
                  style={{ background: 'none', border: '1.5px solid #fca5a5', color: '#ef4444', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  삭제
                </button>
              )}
            </div>
          ))}
          <div style={{ ...S.card, background: '#f0f9ff', border: '1.5px dashed #93c5fd' }}>
            <div style={{ fontWeight: '700', color: '#1d4ed8', marginBottom: '12px' }}>➕ 사이트 직접 추가</div>
            <span style={S.lbl}>사이트 이름</span>
            <input style={S.input} placeholder="예: 링커리어" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} />
            <span style={S.lbl}>사이트 URL</span>
            <input style={S.input} placeholder="예: linkareer.com/list/contest" value={newSiteUrl} onChange={e => setNewSiteUrl(e.target.value)} />
            <button onClick={addSite} style={S.btn('#1d4ed8')}>추가하기</button>
          </div>
        </div>
      )}

    </div>
  );
}
