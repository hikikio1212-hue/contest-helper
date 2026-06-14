// ✅ API 호출 없음 — ANTHROPIC_API_KEY 불필요
// ✅ 문체 자동 판단 — Claude가 공모전 원문을 읽고 직접 결정
// ✅ 카테고리별 평가 기준 동적 적용 + 기획 의도 조건부 포함 + 검색 가이드 단계 포함

// ── 카테고리별 핵심 평가 기준 (없거나 모르는 카테고리는 '기타' 사용) ──────
const EVALUATION_CRITERIA_MAP = {
  '슬로건':  ['상징성(의미)', '대중성(발음·기억 용이성)', '독창성(차별화)', '활용성(확장 가능성)'],
  '아이디어': ['실현 가능성', '창의성(차별성)', '구체성', '기대 효과/파급력'],
  '수기':    ['진솔함/진정성', '서사 구조(완성도)', '감정 전달력(공감도)', '주제 적합성'],
  '사진':    ['주제 전달력', '구도 및 시각적 완성도', '창의성/기획력', '컨셉 설명의 설득력'],
  '디자인':  ['시각적 완성도', '메시지 전달력', '독창성', '활용성/확장성'],
  '영상':    ['기획력/구성', '메시지 전달력', '완성도/편집 아이디어', '독창성'],
  '기타':    ['주제 적합성', '독창성', '완성도', '표현력'],
};

// ── '기획 의도' 설명을 함께 작성해야 유리한 카테고리 ─────────────────────
// (네이밍/슬로건·아이디어·디자인류는 보통 신청서에 '의도/설명' 칸이 있음)
const CONCEPT_CATEGORIES = ['슬로건', '아이디어', '디자인'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청 방법이에요.' });

  const { contest, profile, detailInfo, count = 5 } = req.body;

  // ── 카테고리 결정 (상세 분석 결과 우선, 없으면 목록에서 추정한 값) ─────
  const category    = (detailInfo && detailInfo.category) || contest.category || '기타';
  const criteria    = EVALUATION_CRITERIA_MAP[category] || EVALUATION_CRITERIA_MAP['기타'];
  const criteriaStr = criteria.map((c, i) => `${i + 1}. ${c}`).join(', ');

  const needConcept = CONCEPT_CATEGORIES.includes(category);
  const formatGuide = needConcept
    ? `각 응모안은 [응모안 본문(글자 수) / 기획 의도·설명 (1~3줄, 신청서의 '기획 의도·설명' 칸에 그대로 옮겨 쓸 수 있게 작성)] 형태로 구성하세요.`
    : `각 응모안은 부가 설명 없이, 제출할 [응모글 본문]만 작성하세요. (별도 '기획 의도' 칸이 없는 유형입니다)`;

  // ── 검색용 키워드 (주최가 있으면 주최 기준, 없으면 공모전명 기준) ──────
  const searchSubject = (contest.host && contest.host !== '미상') ? contest.host : contest.title;

  // ── 프로필 섹션 ───────────────────────────────────────────────────
  const profileStr = profile && (profile.name || profile.age || profile.region)
    ? `\n[응모자 프로필]\n${
        profile.name     ? '이름: '           + profile.name     + '\n' : ''}${
        profile.age      ? '나이대: '          + profile.age      + '\n' : ''}${
        profile.region   ? '지역: '            + profile.region   + '\n' : ''}${
        profile.job      ? '직업: '            + profile.job      + '\n' : ''}${
        profile.interest ? '관심사/단골표현: ' + profile.interest + '\n' : ''}`
    : '';

  // ── 상세 조건 + 원문 섹션 ─────────────────────────────────────────
  const detailStr = detailInfo
    ? `\n[공모전 상세 조건 — 반드시 준수]\n${
        detailInfo.charLimit    ? '글자 수 제한: '  + detailInfo.charLimit    + '\n' : ''}${
        detailInfo.target       ? '응모 대상: '     + detailInfo.target       + '\n' : ''}${
        detailInfo.requirement  ? '응모 조건: '     + detailInfo.requirement  + '\n' : ''}${
        detailInfo.prize        ? '시상 내용: '     + detailInfo.prize        + '\n' : ''}${
        detailInfo.category     ? '공모 유형: '     + detailInfo.category     + '\n' : ''}${
        detailInfo.submitMethod ? '제출 방법: '     + detailInfo.submitMethod + '\n' : ''}${
        detailInfo.pageText
          ? '\n[공모전 원문 — 아래 내용을 꼼꼼히 읽고 분석하세요]\n' + detailInfo.pageText.slice(0, 1500) + '\n'
          : ''}`
    : '';

  const prompt = `당신은 공모전 응모글 전문 작가입니다. 아래 공모전 정보와 원문을 꼼꼼히 읽고 당첨 확률이 높은 맞춤형 응모글을 작성하세요.

[공모전 정보]
공모전명: ${contest.title}
주최: ${contest.host || '미상'}
마감: ${contest.deadline || '미상'}
공모 유형: ${category}
출처: ${contest.source || ''}
${detailStr}${profileStr}

다음 순서로 작업하세요:

0. 작성 전 검색 (가능하면 먼저 수행하세요)
   - "${searchSubject} 수상작" 또는 "${searchSubject} 슬로건" 등으로 과거 수상작·캠페인 문구를 검색하세요
   - 결과가 부족하면 "${category} 공모전 수상작 모음 블로그"로 같은 유형의 다른 수상작 패턴을 찾아보세요
   - 검색에서 찾은 어조·구조·핵심 키워드는 '패턴 참고용'으로만 활용하고, 문구를 그대로 베끼지 마세요
   - 검색 결과가 없거나 관련 정보를 찾지 못하면 이 단계는 건너뛰고 바로 1번으로 진행하세요

1. 공모전 분석 (4~5줄)
   - 공모전 원문을 읽고 주제·핵심 키워드·분위기를 파악하세요
   - 이 공모 유형(${category})의 핵심 평가 기준은 다음과 같습니다: ${criteriaStr}
     원문에 별도 평가 기준이 명시되어 있다면 그것을 우선하고, 없으면 위 기준을 사용하세요
   - 글자 수·형식·제출 방법 등 제한 사항을 정리하세요
   - 이 공모전에 어울리는 문체를 스스로 판단하세요
     (예: 공공기관·환경·안전 → 진지하고 격식 있게 / 브랜드·마케팅 → 감각적이고 임팩트 있게 / 청소년 대상 → 친근하게 / 수기·에세이 → 따뜻하고 진솔하게)

2. 응모안 ${count}개 작성
   - ${formatGuide}
   - 위 평가 기준 중 비중이 높은 항목을 응모안 앞부분에 반영하세요
   - 심사위원이 평가 항목을 체크하듯 읽을 수 있게 구성하세요
   - 글자 수 제한이 있으면 각 응모안 옆에 실제 글자 수를 표시하고 반드시 준수하세요
   - 프로필이 있으면 그 관점을 자연스럽게 반영하세요 (어색하게 드러내지 마세요)
   - 각 응모안 끝에 당첨 확률 예측 점수 (60~98점)

3. 상위 2개 A/B 비교
   - 평가 기준(${criteria.join(', ')}) 항목별로 각각 몇 점인지 비교하세요

4. 최종 추천 1개 + 추천 이유`;

  res.json({ prompt });
}
