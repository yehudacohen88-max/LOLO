# Vercel Preview should fail closed

Recommendation only. This change does not modify Vercel project settings, environment variables, or domains. The Vercel connection available while writing this note is not authorized for the LOLO team, so the live Preview values were not listed and were not changed.

## Change to make by hand

In the Vercel project that deploys this repo, remove the Production Supabase credentials from the Preview environment:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` when it points at project ref `fafvveudrlovaozazkny`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` for that same project

Until a separate database exists, leave those three unset for Preview. Do not copy the Production environment into Preview.

The app already fails closed when they are missing. The browser client logs the missing public URL or anon key and throws the Hebrew message "לא הצלחנו לטעון את הנתונים כרגע. נסו שוב בעוד רגע." (`lib/supabase/client.ts`). Server routes that need the service role throw "השירות אינו זמין כרגע. נסו שוב מאוחר יותר." (`lib/security/required-secret.ts`). That is the wanted Preview behavior. A Preview deployment that still holds the Production service role can write Production rows.

Do not put the Production service role in GitHub Actions secrets for `.github/workflows/ci.yml`. That workflow starts Supabase in Docker and exports the loopback demo keys only. It checks that its environment does not contain the Production project ref.

A free second Supabase project for Preview is optional. It was not created. It is a different database from Production, and it is not required for CI. Do not buy a Render service or a Supabase add-on for this.

After the Preview variables are removed, open a Preview deployment and confirm a page that reads data shows the Hebrew setup error, and confirm Production data did not change.
