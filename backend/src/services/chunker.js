function createChunker({
  chunkDurationSec = 300,
  contextPaddingSec = 30,
} = {}) {
  return function chunkTranscript(transcript) {
    if (!transcript?.words?.length) return [];

    const words = transcript.words;
    const firstStart = words[0].start_time;
    const lastEnd = words[words.length - 1].end_time;
    const totalDuration = lastEnd - firstStart;

    const chunkCount = Math.max(1, Math.ceil(totalDuration / chunkDurationSec));
    const chunks = [];

    for (let i = 0; i < chunkCount; i++) {
      const scoredStart = firstStart + i * chunkDurationSec;
      const scoredEnd = Math.min(scoredStart + chunkDurationSec, lastEnd);
      const contextStart = Math.max(firstStart, scoredStart - contextPaddingSec);
      const contextEnd = Math.min(lastEnd, scoredEnd + contextPaddingSec);

      const transcriptSlice = words.filter(
        (w) => w.start_time >= contextStart && w.start_time < contextEnd
      );

      chunks.push({
        chunkIndex: i,
        scoredRange: { start: scoredStart, end: scoredEnd },
        contextRange: { start: contextStart, end: contextEnd },
        transcriptSlice,
      });
    }

    return chunks;
  };
}

module.exports = { createChunker };
