// Real write passphrase for real anon-key integration tests -- never
// hardcoded in source (would leak the production secret into git history).
// Read from a local, gitignored env var instead, mirroring
// supabaseClient.ts's VITE_SUPABASE_ANON_KEY pattern.
const testWritePassphrase = import.meta.env.VITE_TEST_WRITE_PASSPHRASE

if (!testWritePassphrase) {
  throw new Error(
    'Missing VITE_TEST_WRITE_PASSPHRASE environment variable (needed by real anon-key write integration tests)',
  )
}

export { testWritePassphrase }
