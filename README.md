# Edu-RPG: 경험치 통장

RPG 스타일의 교실 경험치 관리 시스템. 초등/중학교 선생님이 학생들의 일일 경험치를 관리하고, 학생들은 매일 경험치를 입력하여 레벨업을 경험합니다.

## 기능 요약

### 학생 기능
- 매일 경험치 입력 (인사, 가치 도장, 과제, 글쓰기, 칭호)
- 본인의 경험치 기록 및 레벨 확인
- 알림 (가치 도장 마일스톤 달성 시)

### 선생님(관리자) 기능
- 학생 목록 조회 (레벨, 누적 경험치)
- 학생별 상세 기록 확인
- 경험치 직접 추가 (즉시 승인)
- 학생 제출 항목 승인/수정/거절
- 감점 적용 (일반, 비율형, 초기화)
- 가치 종류 및 감점 종류 관리

---

## 기술 스택
- **프론트엔드**: HTML + CSS + 바닐라 JavaScript (빌드 도구 없음)
- **백엔드/DB/인증**: [Supabase](https://supabase.com) (PostgreSQL + Auth + JS SDK CDN)
- **호스팅**: [Netlify](https://netlify.com) (정적 파일 드래그 앤 드롭 배포)

---

## 시스템 구조

### 페이지 구성

```
index.html ─── 로그인
  │
  ├─ [학생] student.html ─── 경험치 기록 조회 (레벨, 누적 경험치 테이블)
  │    └── student-input.html ─── 오늘의 경험치 입력
  │
  └─ [관리자] admin-students.html ─── 학생 관리 (메인 대시보드)
       │    ├── 학생 목록 (레벨, 경험치)
       │    ├── 학생 상세 기록
       │    ├── 경험치 직접 추가
       │    └── 감점 적용
       │
       ├── admin-approval.html ─── 승인 관리
       │    ├── 승인 대기 목록
       │    ├── 승인 / 수정 / 거절
       │    └── 전체 승인
       │
       └── admin.html ─── 관리 설정
            ├── 가치 종류 관리 (추가/수정/활성화)
            └── 감점 종류 관리 (일반/비율형/초기화)
```

### 데이터베이스 구조

```
auth.users (Supabase Auth)
  └── profiles (id, name, role, total_xp)
        ├── daily_entries (student_id, date, greetings, assignments, writing_type, status)
        │     ├── entry_value_stamps (entry_id, value_type_id, points, count)
        │     └── titles (entry_id, title_name, status)
        ├── penalties (student_id, penalty_type_id, xp_deducted, count)
        └── notifications (recipient_id, student_id, milestone_level)

value_types (id, name, points, active)
penalty_types (id, name, percent, is_reset, is_rate, rate_unit, rate_unit_count, active)
```

### JavaScript 로드 순서
모든 페이지는 아래 순서로 스크립트를 로드합니다:
```
Supabase CDN → supabase-config.js → auth.js → notifications.js → date-util.js → 페이지별 JS
```

---

## 경험치 시스템

### 경험치 획득 항목
| 항목 | 경험치 |
|------|--------|
| 인사 | 3% |
| 가치 도장 | 기본 5% × 개수 (관리자 설정 가능) |
| 과제 | 5% × 과제 수 |
| 감사 일기 | 5% |
| 주제 글쓰기 | 10% |
| 칭호 | 20% × 칭호 수 (최대 5개) |

### 레벨 시스템
- **100% 경험치 = 1 레벨** (Lv.1부터 시작)
- 표시: `Lv.3 42%` = 레벨 3, 다음 레벨까지 42%
- 경험치 바(XP bar)로 진행도 시각화

### 가치 도장 (Stamp Count)
- 같은 가치 종류를 여러 번 받을 수 있음 (예: 국어 x3 = 15%)
- 학생 입력 시 체크박스 + 횟수 입력
- 10회 누적 시 마일스톤 알림 발생

### 감점 시스템
3가지 감점 유형

| 유형 | 설명 | 예시 |
|------|------|------|
| **일반** | 잔여 경험치의 N% 감점 | 욕설 5%, 폭력 5% |
| **비율형** | 단위 수 기반 감점 (단위 수 / 기준 수 × 퍼센트) | 지각: 20분 / 10분 기준 × 10% = 20% |
| **초기화** | 잔여 경험치 전액 몰수 | 반역 |

여러 감점을 한 번에 적용 가능 (다중 행 UI).

### 경험치 캐싱
- `profiles.total_xp` 컬럼에 누적 경험치 저장
- 승인/거절/감점 시 자동 재계산 (`recalculateAndSaveXP`)
- 학생 목록은 캐싱된 값으로 빠르게 로드

---

## 사용 방법

### 선생님 (관리자)

1. **로그인** → 학생 관리 페이지로 이동
2. **학생 목록**: 모든 학생의 레벨과 경험치 확인
3. **학생 상세보기**: 학생 이름 클릭 → 전체 경험치 기록 타임라인
4. **경험치 직접 추가**: 상세보기 → "경험치 추가" 버튼 → 항목 선택 후 추가 (즉시 승인)
5. **승인 관리**: 상단 네비 "승인 관리" → 학생 제출 항목 승인/수정/거절
6. **감점 적용**: 상세보기 → "감점" 버튼 → 감점 종류/횟수 선택 → 미리보기 확인 후 적용
7. **설정 관리**: 상단 네비 "관리 설정" → 가치 종류 추가/수정, 감점 종류 관리

### 학생

1. **로그인** → 내 기록 페이지로 이동
2. **경험치 확인**: 레벨 바 + 일별 경험치 테이블로 진행도 확인
3. **경험치 입력**: 상단 "경험치 입력" 버튼 → 오늘의 활동 체크/입력 → 제출
4. **알림 확인**: 🔔 알림벨에서 마일스톤 달성 알림 확인

---

## 설치 및 배포

### 1. Supabase 설정
1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase-setup.sql` 실행
3. Authentication > Users에서 관리자/학생 계정 생성
4. 프로필 등록:
```sql
-- 관리자
INSERT INTO profiles (id, name, role) VALUES ('<admin-uuid>', '선생님', 'admin');
-- 학생
INSERT INTO profiles (id, name, role) VALUES ('<student-uuid>', '학생이름', 'student');
```

### 2. 설정 파일
`js/supabase-config.js` 파일 생성:
```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

### 3. 배포
[Netlify](https://netlify.com)에 프로젝트 폴더를 드래그 앤 드롭하여 배포.

### 기존 DB 마이그레이션
기존 배포에서 업그레이드할 경우 `supabase-setup.sql` 하단의 `MIGRATION` 섹션의 ALTER 문을 실행하세요.

---

## 파일 구조

```
edu-rpg/
├── index.html              # 로그인 페이지
├── student.html            # 학생 경험치 기록 조회
├── student-input.html      # 학생 경험치 입력 폼
├── admin-students.html     # 관리자 학생 관리 (메인)
├── admin.html              # 관리자 설정 (가치/감점 종류)
├── admin-approval.html     # 관리자 승인 관리
├── css/
│   └── style.css           # RPG 테마 다크 CSS
├── js/
│   ├── supabase-config.js  # Supabase 연결 설정 (.gitignore)
│   ├── auth.js             # 로그인/로그아웃/라우트 가드
│   ├── date-util.js        # KST 날짜 유틸리티
│   ├── notifications.js    # 마일스톤 체크 + 알림벨 UI
│   ├── student.js          # 학생 기록 테이블
│   ├── student-input.js    # 학생 입력 폼
│   ├── admin-students.js   # 학생 관리 (목록, 상세, 추가, 감점)
│   ├── admin.js            # 관리 설정 (가치/감점 종류 CRUD)
│   └── admin-approval.js   # 승인 관리
├── assets/                 # 아이콘/이미지
├── supabase-setup.sql      # DB 스키마 + RLS + 시드 + 마이그레이션
├── CLAUDE.md               # 개발자용 프로젝트 문서
├── plan.md                 # 구현 이력 + 마이그레이션 가이드
└── README.md               # 이 파일
```
