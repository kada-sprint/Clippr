# Timeout Resolves Instead of Rejecting

The `reframe` function resolves with `{ success: false, error: "timeout" }` when FFmpeg exceeds the timeout, rather than rejecting the Promise. The contract reserves rejection for truly unexpected exceptions; timeout is an expected failure mode listed in the FRD risk table.
