# Requests from Thread C (food and post) to the main thread

## 1. `listMyClaims()` in `src/lib/db.ts`

**Why:** `/food` must show which rescues the current user already holds. The `claims` table allows a user to read their own rows, but `db.ts` has no function for it and threads may not query tables directly.

**Wanted:**

```ts
// Rescue ids the signed-in user has claimed.
export async function listMyClaims(): Promise<string[]> {
  const { data, error } = await supabase.from("claims").select("rescue_id");
  if (error) throw error;
  return data.map((row) => row.rescue_id);
}
```

**Stub in use meanwhile:** `src/components/food/use-claims.ts` keeps claims in `localStorage`. It is correct on the device that claimed, and it also learns from an `already_claimed` reply. It is lost if the browser storage is cleared. Swapping in `listMyClaims()` is a change to that one file.
