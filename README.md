# SEMap — 유럽 여행 기록

포르투갈에 거주하며(2026년 8월 말~2027년 초) 유럽을 여행하는 사람을 위한 **개인 여행 기록 웹앱**.
심야 천문대 톤의 **3D 지구본**에서 국가를 돌려보고, 명소마다 방문 체크·방문일·사진 일지를 남기며,
방문한 나라는 지구본에서 오로라 색으로 활성화됩니다. 폰과 노트북 모두에서 쓰고, 기록은 기기 간에 동기화됩니다.

**정보 기준: 2026년 7월. 모든 콘텐츠는 한국어.**

## 주요 기능

- **3D 지구본** (globe.gl) — 드래그 회전, 휠/핀치 줌, 유럽 포커스. 콘텐츠가 있는 32개국만 밝게·인터랙티브.
- **국가 요약 팝업** — 국기·수도·언어·통화·시차·인구·한 줄 소개·인사말 미리보기의 "게임 프로필" 카드.
- **국가 상세** — 실제 admin-1 행정구역 경계 SVG 지도 + 도시 마커, 도시 사진 카드 그리드.
- **도시 상세** — 명소 사진 카드(역사·소개·방문 팁), 카테고리 태그.
- **방문 기록** — 명소별 방문 체크 + 방문 시작/종료일. 첫 기록 시 지구본에서 그 나라가 활성화.
- **방문 일지** — 명소별 마이크로블로그(텍스트 + 사진 여러 장). 사진은 브라우저에서 리사이즈 후 저장. 자유롭게 추가/삭제. 일지 모아보기에서 전체·국가별로 갤러리 열람.
- **문화 페이지** — 국가별 6개 섹션(한눈에 보기·인사/언어 예절·음식·매너/터부·공휴일/축제·여행 팁) + **인사 키트**(12개 문구 × 현지어·한글 발음).
- **방문 루트** — 계절 최적 추천 순서. 방문 시작일을 넣으면 그 나라들이 날짜순으로 고정.
- **라이트/다크 테마**, 폰·데스크톱 각각 최적화된 반응형 레이아웃.

## 실행

정적 사이트라 빌드가 필요 없습니다. 저장소 루트에서 아무 정적 서버나 띄우면 됩니다.

```bash
npm run serve        # http://localhost:8777 (Node 내장 서버)
# 또는
npx serve .
```

배포판(GitHub Pages) 주소로 접속하면 폰·노트북 어디서나 바로 사용할 수 있습니다.

## 기기 간 동기화 (선택)

서버 없이 GitHub 저장소를 개인 데이터베이스로 씁니다. 방문 기록·일지·사진이
저장소의 `data/user/` 로 자동 커밋되어 폰↔노트북이 같은 기록을 봅니다.

> **개인정보 분리**: 앱 코드 저장소(`semap-1`)는 무료 GitHub Pages 배포를 위해 public이지만,
> 개인 여행 일지·사진은 **별도의 private 저장소**(예: `Younsoeun/semap-data`)로 동기화됩니다.
> 이렇게 하면 배포는 공개하되 개인 기록은 비공개로 유지됩니다.

1. GitHub에서 개인 기록용 **private 저장소**를 하나 만듭니다(예: `semap-data`, 빈 저장소면 됩니다).
2. **Settings → Developer settings → Fine-grained personal access tokens** 에서
   **그 데이터 저장소 하나**에만, **Contents: Read and write** 권한으로 토큰을 발급합니다.
3. 앱의 **설정** 페이지에서 데이터 저장소(`Younsoeun/semap-data`), 브랜치(`main`), 토큰을 입력하고 **저장 후 동기화**.
4. 토큰은 각 기기(브라우저)의 localStorage에만 저장되고 서버로 전송되지 않습니다.
   기록이 바뀔 때마다 자동으로 커밋되고, 다른 기기에서 열면 최신 기록을 당겨옵니다(사진은 인증 API로 로드).

동기화를 쓰지 않을 때는 설정의 **JSON 내보내기/가져오기**로 수동 백업할 수 있습니다(사진 제외).

## 데이터 파이프라인

콘텐츠·지리 데이터는 스크립트로 생성됩니다(평소엔 재실행 불필요).

```bash
npm run migrate      # 기존 SE_map 프로젝트 → data/content/*.json
npm run build:geo    # Natural Earth → data/geo/world.json + 국가별 admin-1 지도
```

- 명소 설명의 사실(건립연도·건축가·유네스코 지정연도 등)은 웹 리서치로 검증된 값입니다.
- 국가 모양은 일러스트가 아니라 실제 국경선(Natural Earth) 데이터이며, 내부 행정구역 경계까지 그립니다.
- 명소·도시 사진은 Wikipedia/Wikimedia Commons의 실제 랜드마크 사진입니다.

## 구조

```
index.html            SPA 진입점(해시 라우팅)
css/                  theme(디자인 토큰) · components · views
js/
  app.js router.js theme.js globe.js data-loader.js ui.js
  store/              local(localStorage+IndexedDB) · visits(도메인) · github-sync · backup
  views/              country-popup · country · city · journal · culture · route · settings
data/
  content/            countries/*.json · culture · profiles · greetings · images · route
  geo/                world.json · countries/*.json
  user/               visits/일지/사진 (동기화 대상, 앱이 생성)
vendor/globe.gl.min.js
build/                serve · fetch-geo · migrate-from-semap
```
