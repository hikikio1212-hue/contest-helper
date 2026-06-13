// ✅ API 호출 없음 — ANTHROPIC_API_KEY 불필요
// ✅ 문체 자동 판단 — Claude가 공모전 원문을 읽고 직접 결정

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청 방법이에요.' });

  const { contest, profile, detailInfo, count = 5 } = req.body;

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
출처: ${contest.source || ''}
${detailStr}${profileStr}

다음 순서로 작업하세요:

1. 공모전 분석 (4~5줄)
   - 공모전 원문을 읽고 주제·핵심 키워드·분위기를 파악하세요
   - 평가 기준 항목과 비중을 원문에서 찾아서 정리하세요 (없으면 공모 유형으로 추정)
   - 글자 수·형식·제출 방법 등 제한 사항을 정리하세요
   - 이 공모전에 어울리는 문체를 스스로 판단하세요
     (예: 공공기관·환경·안전 → 진지하고 격식 있게 / 브랜드·마케팅 → 감각적이고 임팩트 있게 / 청소년 대상 → 친근하게 / 수기·에세이 → 따뜻하고 진솔하게)

2. 응모글 ${count}개 작성
   - 평가 기준 비중이 높은 항목을 응모글 앞부분에 배치하세요
   - 심사위원이 평가 항목을 체크하듯 읽을 수 있게 구성하세요
   - 글자 수 제한이 있으면 각 응모글 옆에 실제 글자 수를 표시하고 반드시 준수하세요
   - 프로필이 있으면 그 관점을 자연스럽게 반영하세요 (어색하게 드러내지 마세요)
   - 각 응모글 끝에 당첨 확률 점수 (60~98점)

3. 상위 2개 A/B 비교
   - 평가 기준 항목별로 각각 몇 점인지 비교하세요

4. 최종 추천 1개 + 추천 이유`;

  res.json({ prompt });
}
