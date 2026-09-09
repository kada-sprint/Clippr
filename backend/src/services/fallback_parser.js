class ParseFailure {
  constructor(rawOutput, error) {
    this.rawOutput = rawOutput;
    this.error = error;
    this.isFailure = true;
  }
}

function extractJsonBlock(text) {
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) return jsonBlockMatch[1].trim();

  const codeBlockMatch = text.match(/```\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const jsonMatch = text.match(/\{[\s\S]*"segments"[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  const partialMatch = text.match(/"segments"\s*:\s*\[[\s\S]*/);
  if (partialMatch) {
    let extracted = partialMatch[0];
    if (!extracted.startsWith('{')) {
      extracted = '{' + extracted;
    }
    return extracted;
  }

  return null;
}

function tryParse(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.segments)) {
      return parsed;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function repairAndParse(text) {
  let repaired = text.trim();

  repaired = repaired.replace(/,\s*([\]}])/g, '$1');

  let result = tryParse(repaired);
  if (result) return result;

  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/]/g) || []).length;

  if (openBrackets > closeBrackets) {
    repaired += ']'.repeat(openBrackets - closeBrackets);
  }
  if (openBraces > closeBraces) {
    repaired += '}'.repeat(openBraces - closeBraces);
  }

  result = tryParse(repaired);
  if (result) return result;

  repaired = repaired.replace(/:\s*\d+$/, ': null');
  result = tryParse(repaired);
  if (result) return result;

  repaired = repaired.replace(/"([^"]*)$/, '"$1"');
  result = tryParse(repaired);
  if (result) return result;

  return null;
}

function extractField(text, fieldNames) {
  for (const name of fieldNames) {
    const patterns = [
      new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`),
      new RegExp(`"${name}"\\s*:\\s*([\\d.]+)`),
      new RegExp(`${name}\\s*[:=]\\s*"([^"]*)"`),
      new RegExp(`${name}\\s*[:=]\\s*([\\d.]+)`),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
  }
  return null;
}

function extractTimestamp(text, keywords) {
  for (const keyword of keywords) {
    const patterns = [
      new RegExp(`${keyword}[\\s:=]*(\\d{1,3})\\s*(?:detik|seconds?|s)`, 'i'),
      new RegExp(`${keyword}[\\s:=]*(\\d{1,2})\\s*[.:]\\s*(\\d{2})`, 'i'),
      new RegExp(`"${keyword}"\\s*:\\s*(\\d+\\.?\\d*)`),
      new RegExp(`${keyword}[\\s:=]*(\\d+\\.?\\d*)`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
        return parseFloat(match[1]);
      }
    }
  }
  return null;
}

function extractAllTimestamps(text) {
  const timestamps = [];
  const patterns = [
    /detik\s+(\d+)/gi,
    /start_time["\s:]*(\d+)/gi,
    /end_time["\s:]*(\d+)/gi,
    /mulai\s+(\d+)/gi,
    /berakhir\s+(\d+)/gi,
    /selesai\s+(\d+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      timestamps.push({ value: parseFloat(match[1]), index: match.index });
    }
  }

  timestamps.sort((a, b) => a.index - b.index);
  return timestamps;
}

function parseWithRegex(text) {
  const title = extractField(text, ['suggested_title', 'title', 'judul']);
  const score = extractField(text, ['concept_score', 'score', 'skor']);
  const reason = extractField(text, ['pedagogical_reason', 'reason', 'alasan']);

  let startTime = extractTimestamp(text, ['start_time', 'start', 'mulai', 'awal']);
  let endTime = extractTimestamp(text, ['end_time', 'end', 'selesai', 'akhir']);

  if (startTime === null || endTime === null) {
    const timestamps = extractAllTimestamps(text);
    if (timestamps.length >= 2) {
      startTime = timestamps[0].value;
      endTime = timestamps[timestamps.length - 1].value;
    } else if (timestamps.length === 1) {
      return null;
    }
  }

  if (startTime === null || endTime === null) {
    return null;
  }

  const duration = endTime - startTime;
  if (duration < 25 || duration > 75) {
    return null;
  }

  return {
    segments: [{
      start_time_seconds: startTime,
      end_time_seconds: endTime,
      duration,
      concept_score: score ? parseInt(score) : null,
      suggested_title: title || 'Clip tanpa judul',
      pedagogical_reason: reason || null,
    }],
  };
}

function parseFallback(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return new ParseFailure(rawOutput, 'Empty or non-string input');
  }

  const jsonText = extractJsonBlock(rawOutput);
  if (jsonText) {
    const directParse = tryParse(jsonText);
    if (directParse) return directParse;

    const repaired = repairAndParse(jsonText);
    if (repaired) return repaired;
  }

  const regexResult = parseWithRegex(rawOutput);
  if (regexResult) {
    return regexResult;
  }

  return new ParseFailure(rawOutput, 'Unable to extract clip data from response');
}

module.exports = { parseFallback, ParseFailure };
