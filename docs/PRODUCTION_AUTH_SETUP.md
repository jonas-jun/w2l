# 프로덕션 인증 설정 (T5.2)

Supabase 대시보드 작업이라 코드로 자동화하지 않는다. 아래 순서대로 진행한다.
**T5.3(배포)로 프로덕션 도메인을 먼저 확보한 뒤** 2번부터 진행하는 것이 편하다.

## 진행 상태 (2026-08-21)

- [ ] 1. 커스텀 SMTP — **보류**. 도메인 미보유. 도메인 생기면 진행.
- [x] 2. 리다이렉트 URL 등록 — 완료. 관리 API(`GET /v1/projects/{ref}/config/auth`)로
      `site_url`, `uri_allow_list`가 `https://w2l-delta.vercel.app`(`/**`)로 반영된 것을 확인.
- [x] 3. 이메일 확인 켜기 — 완료. 같은 API로 `mailer_autoconfirm: false` 확인.
- [ ] 4. 검증(AC) — **부분 완료**. `junhot08+w2ltest@gmail.com`으로 실제 가입을 시도했으나
      Supabase 기본 SMTP의 `over_email_send_rate_limit`(시간당 발송 제한)에 막혀 메일
      수신·링크 클릭까지는 확인하지 못했다. 대신:
      - 가입 시 세션이 즉시 생성되지 않는 것(`access_token` 없음)은 확인함 — 확인 대기 상태로
        전환되는 것 자체는 동작함.
      - `/auth/callback` 코드 경로는 로컬(Mailpit)에서 가입→메일 수신→링크 클릭→온보딩까지
        11개 시나리오로 이미 검증됨, 이후 변경 없음.
      - 1번(커스텀 SMTP)을 연결하면 레이트리밋이 사실상 사라지므로, 그때 실제 수신 테스트를
        마저 하는 것을 권한다.

앱 쪽 코드는 이미 준비되어 있다 — 확인 메일의 링크는 `/auth/callback`으로 돌아오고,
거기서 code를 세션으로 교환한 뒤 닉네임 온보딩으로 보낸다.

---

## 1. 커스텀 SMTP 연결

Supabase 내장 SMTP는 시간당 발송 제한이 있는 데모용이다 (ARCHITECTURE.md §4).
정식 오픈 전에 반드시 교체한다.

1. [Resend](https://resend.com) 등에서 도메인을 인증하고 SMTP 자격 증명을 발급받는다.
2. Supabase 대시보드 → **Authentication → Emails → SMTP Settings**
3. **Enable Custom SMTP**를 켜고 입력한다.

| 항목 | 값 (Resend 기준) |
|---|---|
| Sender email | `no-reply@<인증한 도메인>` |
| Sender name | 어디살래? |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API 키 |

> 발신 도메인의 SPF/DKIM을 설정하지 않으면 스팸함으로 간다.

## 2. 리다이렉트 URL 등록 ⚠️

**이 단계를 빠뜨리면 확인 메일이 엉뚱한 곳으로 간다.** Supabase는 허용 목록에 없는
리다이렉트 URL을 조용히 무시하고 Site URL로 폴백한다 (에러를 내지 않는다).

Supabase 대시보드 → **Authentication → URL Configuration**

- **Site URL**: `https://<프로덕션 도메인>`
- **Redirect URLs**: 아래를 모두 추가
  - `https://<프로덕션 도메인>/**`
  - `https://<Vercel 프리뷰 도메인>/**` (프리뷰 배포에서도 가입을 테스트하려면)

## 3. 이메일 확인 켜기

Supabase 대시보드 → **Authentication → Sign In / Providers → Email**

- **Confirm email**을 **켠다**.

> 로컬(`supabase/config.toml`)은 개발 편의를 위해 꺼둔 채로 둔다. 로컬에서 확인 메일
> 흐름을 다시 검증하려면 `enable_confirmations = true`로 바꾸고
> `supabase stop && supabase start` 후 Mailpit(http://127.0.0.1:54324)에서 메일을 확인한다.

## 4. 검증 (Acceptance Criteria)

실제 이메일 주소로 프로덕션에서 확인한다.

1. `https://<프로덕션 도메인>/signup`에서 가입
2. "가입 확인 이메일을 보냈습니다." 화면이 뜬다
3. 확인 메일 수신 → 링크 클릭
4. `/auth/callback`을 거쳐 닉네임 설정 화면으로 이동한다
5. 닉네임 설정 후 홈으로 이동, 새로고침해도 로그인 상태가 유지된다

확인 전 로그인 시도는 실패해야 하고, 만료·재사용된 링크는 로그인 화면에서
"인증 링크가 만료되었거나 이미 사용되었습니다." 안내가 떠야 한다.

## 참고: 이미 만든 운영 계정

`scripts/seed-accounts.ts`는 `email_confirm: true`로 계정을 만들기 때문에
이메일 확인을 켜도 그대로 로그인할 수 있다.
