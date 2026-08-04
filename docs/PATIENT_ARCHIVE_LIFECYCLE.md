# Patient archive lifecycle

Patient clinical records are never permanently deleted by the application.

## Surgery queue cancellation

- A Project Manager submits a cancellation request with a structured reason.
- The placement remains scheduled until a Super Administrator approves it.
- Approval changes only the surgery placement to `Cancelled`.
- The patient remains active and all clinical history remains available.
- A Super Administrator may cancel a placement directly using the same reason form.

## Patient archival

- A Project Manager submits an archive request from the Patients page.
- A Super Administrator reviews the impact and approves or rejects it in Inbox.
- Approval archives the patient and any active scheduled or postponed placements in one transaction.
- Completed clinical history is preserved.
- A Super Administrator can archive directly only after selecting a reason and typing the patient code.

## Restoration

- Archived patients are listed under Reports → Archived Patients.
- Only a Super Administrator can restore a patient, with a mandatory justification.
- Restoration never reschedules prior surgery placements.
- Archive, cancellation, approval, rejection, and restoration operations are audited.

## Database safeguards

Migration `20260804183000_archive_only_patient_lifecycle`:

- blocks `DELETE` on `patients` with a database trigger;
- prevents duplicate pending archive and cancellation requests;
- constrains change-request entity, type, and status values;
- stores structured surgery cancellation metadata.

Before applying the migration, verify that no patient/entity has multiple pending archive requests. The migration fails without changing records if duplicates are found; resolve those requests explicitly and retry.
