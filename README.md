# 전북천년명가 모션그래픽 (9:16 · 20s)

전북천년명가(전북특별자치도 공식 인증 전통명가) 홍보용 세로형 모션그래픽 영상 프로젝트.

- 규격: 1080×1920 · 30fps · 20.0초 · H.264 + AAC
- 음악: Mixkit "Lust" (166.67 BPM)
- 음량: −12.5 LUFS / −1.3 dBTP
- 콘셉트: "시간이 증명한 이름" — 30년을 지켜온 가게들이 100년을 향해 가고, 그 이름이 전북천년명가가 된다
- 구성: 3D "30년" 포털 → 전북/천년/명가 3D 타이틀 → 14개 시·군 3D 지도 → 30→100년 성장 타워와 가업승계 → 지원내용 4면 큐브 → 3D BI 로고
- 완성 영상: Higgsfield 결과 위젯(대화창)에서 미리보기·다운로드

## 폴더
- `source/` — 원본 자료 (jbsos.or.kr 안내 페이지 캡처, BI 로고)
- `docs/storyboard.md` — 콘티(구간별 시간·박·화면·카피)와 효과음 큐 시트
- `motion/` — 렌더러
  - Three.js(WebGL) 3D + Canvas2D 타이포그래피를 Katana 컴포지터 훅(`fx.js`)으로 실행
  - `mg/sec*.js` 구간별 장면, `mg/main.js` 구간 라우팅·모션 블러·비트 펌프·HUD·그레인
- `tools/` — 보조 스크립트
  - `vectorize_logo.py` 로고 벡터화
  - `build_map.py` 전북 14개 시·군 지도 데이터 생성 (KOSTAT 2018 경계)
  - `mix.py` 효과음 배치와 믹스
- `katana/` — 작업 계약서, 생성 계획, AI 생성 프롬프트
  - Higgsfield Soul Cinema 장소 스틸, Seedance 2.5 실사 컷
- `audio/README.md` — 음악·효과음 출처와 라이선스, 마스터 수치

## 렌더 (Katana 샌드박스)
```
bash repo/motion/sync.sh
python3 $RR/comp/render.py render $W --no-sfx --audio audio/final_mix.m4a --crf 16 --preset slow --quality 0.97
```
