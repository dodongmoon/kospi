# 코스피 3저호황 비교 차트

1983년 6월 1일 시작 7년 구간과 2023년 1월 1일 시작 7년 구간을 **같은 경과 개월 축**으로 겹쳐 보는 정적 웹 페이지입니다.

## 1) 데이터 준비

```bash
python3 scripts/fetch_kospi.py
```

- 원천: stooq `^kospi` 일봉 CSV
- 저장 위치: `public/data/kospi.csv`

## 2) 실행

```bash
python3 -m http.server 8000 -d public
```

브라우저에서 `http://localhost:8000` 접속.

## 2-1) 매일 자동 업데이트 (macOS)

하루 1회 장 마감 후 자동으로 `public/data/kospi.csv`를 갱신하려면:

```bash
./scripts/install_launchd.sh 16 10
```

- 형식: `install_launchd.sh <시> <분>` (로컬 타임존 기준)
- 예시: `16 10`이면 매일 16:10 실행
- 로그: `logs/launchd.out.log`, `logs/launchd.err.log`

즉시 수동 갱신:

```bash
./scripts/update_data.sh
```

자동 갱신 해제:

```bash
./scripts/uninstall_launchd.sh
```

## 3) 차트 기준

- 기본 모드: `1983 구간을 2023 시작값으로 환산`
  - Y축은 로그 스케일, 눈금은 코스피 지수값 `2,000 / 4,000 / 8,000 / 16,000 / 32,000`
- 보조 모드: `상승률 (시작점=100)` (로그 스케일)

두 모드 모두 Y축은 로그 스케일입니다.
