# Two Separate Video Path Fields per Clip

Each clip stores two distinct video paths: `clip_video_path` (raw 9:16 reframe) and `subtitled_video_path` (reframe with burned subtitles). The frontend silently shows the best available version via `subtitled_video_path || clip_video_path`.

This preserves the raw vertical render for re-rendering with different subtitle styles without re-running the expensive FFmpeg reframe pass (~30-60s). Subtitle burning is fast (~5-10s) and stateless per ADR-0007.

Considered a single `clip_video_path` field overwritten with the subtitled version after burn. Rejected because: (1) loses the raw reframe, making subtitle style changes require a full re-render, (2) the two files have different lifecycle triggers (reframe on curation, subtitle burn on user action), (3) the frontend needs to distinguish between "video exists but no subtitles yet" and "video with subtitles ready."
