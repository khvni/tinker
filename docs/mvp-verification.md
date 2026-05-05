# MVP verification

## M8.15 identity scoping

Use two different OAuth accounts on the same machine.

1. Sign in as User A.
2. Pick session folder `F`.
3. Send one chat message and wait for the assistant response to finish.
4. Confirm a chat history file exists under `F/.tinker/chats/<user-a-id>/<session-id>.jsonl`.
5. Close and reopen Tinker.
6. Sign out User A.
7. Sign in as User B.
8. Confirm User A's session for folder `F` is not visible in the session switcher.
9. Pick the same session folder `F`.
10. Send one chat message and wait for the assistant response to finish.
11. Confirm Tinker created a different chat history file under `F/.tinker/chats/<user-b-id>/<new-session-id>.jsonl`.
12. Confirm User B's memory injection reads from `<memory_root>/<user-b-id>/`; on a fresh User B profile it should inject no notes from User A's subdirectory.
13. Sign out User B.
14. Sign back in as User A.
15. Confirm User A's original folder `F` session is visible in the switcher.
16. Open it and confirm the chat hydrates from `F/.tinker/chats/<user-a-id>/<session-id>.jsonl`.

Pass criteria: User B never sees User A's session, User B gets a new per-user JSONL path for the same folder, User B memory context excludes User A's memory subdir, and User A's original session restores after switching back.
