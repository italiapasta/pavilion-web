# 길을 여는 벽 — 파빌리온 웹

BIG Serpentine Pavilion 2016 변형. Grasshopper(블록 단위 + Kangaroo) + Ladybug + three.js.

## 폴더

```
index.html      화면 구성 (1~5단계 글)
style.css       디자인
main.js         three.js 장면, 단계별 동작 (맨 위 AUTHOR에 이름 입력)
gh_canvas.png   Grasshopper 캔버스 캡처 (직접 넣기)
models/
  pavilion_after.glb   고친 후 (Kangaroo 아치 + AI 검토 후 규칙), 단위 m
  pavilion_before.glb  고치기 전 (A자 리브)
  data_shade.glb       그늘 일사 데이터 색
  joint.glb            노드 조인트 확대
  process.json         동선 · Kangaroo 사슬 좌표
  counts_*.json        블록 종류별 개수
```

## 로컬에서 보기

```
cd web
npx serve
```

브라우저에서 표시되는 `http://localhost:3000` 주소로 엽니다. (파일 더블클릭으로는 glb가 열리지 않습니다.)

## 배포 (GitHub + Vercel)

1. GitHub에서 새 저장소 만들기 (예: `pavilion-web`)
2. 이 `web` 폴더에서
   ```
   git init
   git add .
   git commit -m "pavilion web"
   git branch -M main
   git remote add origin https://github.com/<아이디>/pavilion-web.git
   git push -u origin main
   ```
3. vercel.com → Add New → Project → 저장소 선택 → Framework: Other → Deploy
4. 나온 주소(`https://pavilion-web-xxxx.vercel.app`)를 제출 칸에 적기

모델을 다시 내보내면 `models/` 파일만 바꾸고 `git add . && git commit -m "update" && git push` 하면 Vercel이 자동으로 다시 배포합니다.
