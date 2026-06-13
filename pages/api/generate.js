export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청 방법이에요.' });

  const { contest, profile, detailInfo, count = 5, tone = '자연스럽게' } = req.body;

  const toneGuide = {
    '자연스럽게': '일상적이고 자연스러운 문체로',
    '감성적으로': '따뜻하고 감성적인 문체로, 공감을 이끌어내도록',
    '유머있게':   '밝고 유머러스한 문체로, 기억에 남도록',
    '공식적으로': '격식 있고 진지한 문체로',
    '간결하게':   '짧고 임팩트 있게, 핵심만 담아',
  }[tone] || '자연스럽게';

  const profileStr = profile && (profile.name || profile.age || profile.region)
    ? `\n[응모자 프로필]\n${
        profile.name     ? '이름: '           + profile.name     + '\n' : ''}${
        profile.age      ? '나이대: '          + profile.age      + '\n' : ''}${
        profile.region   ? '지역: '            + profile.region   + '\n' : ''}${
        profile.job      ? '직업: '            + profile.job      + '\n' : ''}${
        profile.interest ? '관심사/단골표현: ' + profile.interest + '\n' : ''}`
    : '';

  const detailStr = detailInfo
    ? `\n[공모전 상세 조건 — 반드시 준수]\n${
        detailInfo.charLimit    ? '글자 수 제한: '  + detailInfo.charLimit    + '\n' : ''}${
        detailInfo.target       ? '응모 대상: '     + detailInfo.target       + '\n' : ''}${
        detailInfo.requirement  ? '응모 조건: '     + detailInfo.requirement  + '\n' : ''}${
        detailInfo.prize        ? '시상 내용: '     + detailInfo.prize        + '\n' : ''}${
        detailInfo.category     ? '공모 유형: '     + detailInfo.category     + '\n' : ''}${
        detailInfo.submitMethod ? '제출 방법: '     + detailInfo.submitMethod + '\n' : ''}${
        detailInfo.pageText     ? '\n[공모전 원문 발췌 — 조건 파악에 활용]\n' + detailInfo.pageText.slice(0, 1500) + '\n' : ''}`
    : '';

  const prompt = `당신은 공모전 응모글 전문 작가입니다. 당첨 확률을 높이는 맞춤형 응모글을 작성하세요. 글자 수 제한이 있으면 반드시 준수하고 각 응모글 옆에 실제 글자 수를 표시하세요.

[공모전 정보]
공모전명: ${contest.title}
주최: ${contest.host || '미상'}
마감: ${contest.deadline || '미상'}
출처: ${contest.source || ''}
${detailStr}${profileStr}

다음 순서로 작업하세요:

1. 당첨 패턴 분석 (2~3줄)
   - 이 유형 공모전에서 당첨된 작품들의 공통 특징
   - 글자 수/형식 제한이 있으면 반드시 언급
   - 원문이 있다면 주제 방향과 키워드 파악

2. 응모글 ${count}개 작성 (문체: ${toneGuide})
   - 글자 수 제한이 있으면 각 응모글 옆에 실제 글자 수 표시 및 제한 준수
   - 프로필이 있으면 그 관점을 자연스럽게 반영
   - 각 응모글 끝에 당첨 확률 점수 (60~98점)

3. 상위 2개 A/B 비교

4. 최종 추천 1개 + 추천 이유`;

  res.json({ prompt });
}
