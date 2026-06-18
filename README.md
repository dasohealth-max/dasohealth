# EyeCare Pro

Focused regional eye surgery campaign management for Somalia.

## Scope

Active modules:

- Dashboard
- Campaigns
- Patients
- Screening
- Surgeries
- Follow-ups
- Reports
- Settings / Users

Removed from the active app surface:

- Referrals
- Inventory
- Transport
- Outreach
- Map-based location management

## Workflow

1. Super Administrator creates a Project Manager user and assigns one region.
2. Super Administrator creates a campaign for one region, one operation district/city, a surgery target, and an assigned Project Manager.
3. Project Manager creates Data Clerk and Screening Officer users for the same assigned region.
4. Data Clerk registers patients into a campaign.
5. Patients enter the screening queue automatically.
6. Screening Officer records screening results.
7. A screening recommendation of `Refer for Surgery` creates a scheduled surgery record.
8. Screening Officer updates surgery status and records actual surgery completion date.
9. Completed surgery creates Day 1, Week 1, Month 1, and Month 3 follow-up tasks.
10. Follow-up records capture notes, outcome, and whether doctor review is needed.

## Verification

```bash
npm run lint
npm run build
```

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.
