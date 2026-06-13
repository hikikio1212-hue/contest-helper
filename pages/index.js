import { useState, useEffect, useMemo } from 'react';

const DEFAULT_SITES = [
  { id: 'wevity',    name: '위비티',         url: 'https://www.wevity.com',        active: true },
  { id: 'contest',   name: '콘테스트코리아',  url: 'https://www.contestkorea.com', active: true },
  { id: 'thinkgood', name: '씽굿',            url: 'https://www.thinkcontest.com', active: true },
];

const EMPTY_PROFILE = { label: '', name: '', age: '', region: '', job: '', interest: '' };
const CATEGORIES    = ['전체', '슬로건', '사진', '수기', '아이디어', '디자인', '영상', '기타'];
const TONES         = ['자연스럽게', '감성적으로', '유머있게', '공식적으로', '간결하게'];

function parseDeadlineScore(deadline) {
  if (!deadline) return 9999;
  const dMatch = deadline.match(/D-(\d+)/i);
  if (dMatch) return parseInt(dMatch[1]);
  if (deadline.includes('마감임박') || deadline.includes('D-0')) return 0;
  const full = deadline.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (full) {
    const d = new Date(parseInt(full[1]), parseInt(full[2]) - 1, parseInt(full[3]));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / 86400000);
  }
  const short = deadline.match(/(\d{1,2})[.\/-](\d{1,2})/);
  if (short) {
    const now = new Date();
    let d = new Date(now.getFullYear(), parseInt(short[1]) - 1, parseInt(short[2]));
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / 86400000);
  }
  return 9999;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr.replace(/\./g, '-'));
  if (isNaN(target)) return null;
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
  const [sort, setSort]                     = useState('deadline');
  const [regionFilter, setRegionFilter]     = useState('');
  const [catFilter, setCatFilter]           = useState('전체');
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
  const [genTone, setGenTone]               = useState('자연스럽게');
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

  const copyWithFeedback = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(p => ({ ...p, [key]: true }));
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000);
  };

  const fetchContests = async () => {
    setLoading(true); setContests([]); setSiteStatus([]); setDetail({}); setResults({});
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
