# IbshCareer backend

Express API for the IbshCareer email finder: auth (JWT), email lookup (Prospeo, Snov.io, Apollo), Stripe billing, and an AI outreach agent.

Setup: `npm install`, copy `.env.example` to `.env` and fill it in, then `npm start`.

## Outreach agent (Claude)

The agent finds a contact's email and drafts a personalized outreach email. Drafts wait in a queue, and nothing is sent until you approve it. All routes need `Authorization: Bearer <JWT>`.

| Method | Path | Body | What it does |
|---|---|---|---|
| POST | `/api/outreach/draft` | `name`, `goal`, plus optional `company`, `title`, `linkedinUrl`, `email`, `about` (sender background), `tone` | Looks up the email if none is given (1 credit on the free plan when one is found), then drafts the subject and body |
| GET | `/api/outreach?status=pending` | | Lists your drafts |
| PATCH | `/api/outreach/:id` | `subject`, `body`, `toEmail` | Edits a draft before approving it |
| POST | `/api/outreach/:id/approve` | | Sends through Resend (`RESEND_API_KEY`, `EMAIL_FROM`) with reply-to set to your account email. Without Resend, it marks the draft approved and returns a `mailto:` link |
| POST | `/api/outreach/:id/reject` | | Discards the draft |

Drafts use only the facts you provide. Check `personalizationNotes` before you approve.
