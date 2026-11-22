# Orphan image cleanup — plan only

This document does not delete anything. It does not add a cron job, a storage delete call, or delete-on-replace. Replacing a host photo still uploads a new object and leaves the previous one in place.

## Why objects become orphans

`POST /api/uploads/images` writes a public object under `covers/<uuid>.<jpg|png|webp>` or `gifts/<uuid>.<jpg|png|webp>` in the `gift-images` bucket before an event row exists. The create-event flow can abandon that URL. A later host replace writes another object and updates `events.cover_image` or `event_gifts.image_url` without removing the previous object.

Library photos are not in this bucket. They live under `public/images/library/` and are referenced as site paths such as `/images/library/birthday/balloon-party-hero.webp`.

## What a cleanup must never delete

- Any object whose public URL or bucket path is still stored in `events.cover_image` or `event_gifts.image_url`.
- Any object that is not an upload path of the form `covers/<uuid>.<jpg|png|webp>` or `gifts/<uuid>.<jpg|png|webp>`.
- Library files, whether they live in `public/images/library/` or were copied into the bucket under any other path.
- Objects newer than N days. Proposed N is **14**, so a draft that was uploaded and not published yet can still be saved. Confirm N before any delete.
- Objects in any bucket other than `gift-images`.

Match references by the exact public URL and by the bucket-relative path inside it. Ignore empty values, `data:` URLs, and library paths: they are not candidates, and they are not a reason to delete something else.

## Safe procedure

1. **Dry-run only.** List objects. Write a report. Do not call delete.
2. List `gift-images` objects older than N days whose names match the upload path above. Record path, size, and created time.
3. Read `events.cover_image` and `event_gifts.image_url` with a read-only query. Normalize each value that points at `gift-images` to a bucket-relative path. This read is a review step for a human operator. It is not part of this change, and it must not run against production from an unattended job until the operator approves the procedure.
4. Candidates are listed objects minus referenced paths. Drop anything that is not an upload path, anything younger than N days, and anything whose path contains `..`, a backslash, or a library prefix.
5. Publish the report: path, size, created time, and the reason it is a candidate. Include the count of referenced objects that were protected.
6. **Manual approval.** A person approves that exact report (a hash of the path list is enough). Approval of an older report does not apply to a new list.
7. Only after that approval, delete the approved paths in a separate step. Immediately before each delete, check again that the path is still absent from `events.cover_image` and `event_gifts.image_url`. Skip the object if a host saved it after the report.
8. Run the dry-run a second time and confirm every referenced upload path is still present.

No schema change, no new RLS policy, and no automatic deletion are required for the report. A later change can add the delete step only after the dry-run has been reviewed.

## Explicitly out of scope

- Deleting the previous object when a host replaces a cover or gift image.
- A scheduled job that deletes on its own.
- Changing payments, orders, or the beta gate.
