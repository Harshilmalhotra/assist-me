const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const db = require('../db');
const config = require('../config');

// Initialize Gemini client only if key is present
const genAI = config.gemini.apiKey ? new GoogleGenerativeAI(config.gemini.apiKey) : null;

async function transcribeAudio(audioPath) {
  if (!genAI) {
    console.log('\x1b[33m%s\x1b[0m', '[GEMINI MOCK] Skipping Gemini audio transcription (API Key missing). Returning mock transcript.');
    return `[00:05] Customer: Hi, I've been trying to set up my home router but the WAN light is flashing red.
[00:15] Agent: Hello! I can help you with that. Can you point your phone camera at the back of the router?
[00:25] Customer: Sure, let me rotate the device. Here it is.
[00:35] Agent: Ah, I see the issue. The blue internet cable is plugged into the yellow LAN port instead of the blue WAN port.
[00:48] Customer: Let me swap it. Okay, I just plugged it into the WAN port.
[00:58] Agent: Perfect. The connection light should turn solid green shortly.
[01:08] Customer: Yes! The light is green now and my phone is showing internet access. Thank you so much!
[01:18] Agent: Excellent! I'm glad we could get that resolved. I'll end the session now. Have a great day!`;
  }

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const audioPart = {
    inlineData: {
      data: fs.readFileSync(audioPath).toString('base64'),
      mimeType: 'video/mp4' // Using video/mp4 since ffmpeg saves it in mp4 format
    }
  };

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = 'Please provide a transcript of this audio support call. Format the output with timestamp markers and specify if the speaker is the customer or the agent.';

  const result = await model.generateContent([prompt, audioPart]);
  return result.response.text();
}

async function analyzeWithGemini(transcript, chatMessages) {
  if (!genAI) {
    console.log('\x1b[33m%s\x1b[0m', '[GEMINI MOCK] Skipping Gemini analysis (API Key missing). Returning mock JSON analysis.');
    return {
      summary: "• Customer experienced a flashing red WAN status light on their home router.\n• Support Agent visually diagnosed a cabling error: internet cable was in LAN port.\n• Customer swapped the cable into the correct WAN port.\n• Connection status turned green and internet access was successfully restored.",
      action_items: [
        "Customer to verify wifi speeds on other home devices.",
        "Agent to mark the support ticket as resolved in the internal CRM."
      ],
      sentiment_timeline: [
        { minute: 0, score: 4, note: "Customer frustrated with connection issues" },
        { minute: 1, score: 7, note: "Agent identifies cabling issue" },
        { minute: 2, score: 10, note: "Cabling corrected, connection restored" }
      ],
      overall_sentiment: 8,
      predicted_csat: 5,
      resolution_status: "resolved",
      keywords: ["router", "WAN light", "cabling", "installation", "internet link", "resolution"]
    };
  }

  const chatLog = chatMessages.map(m =>
    `[${m.sender_role.toUpperCase()} - ${m.sender_name}]: ${m.content}`
  ).join('\n');

  const prompt = `You are analyzing a customer support session.

CALL TRANSCRIPT:
${transcript}

CHAT MESSAGES:
${chatLog || '(no chat messages)'}

Return ONLY a valid JSON object. Shape:
{
  "summary": "3 to 5 bullet points separated by newlines, each starting with •",
  "action_items": ["string", "string"],
  "sentiment_timeline": [
    { "minute": 0, "score": 7, "note": "brief description" }
  ],
  "overall_sentiment": 7,
  "predicted_csat": 4,
  "resolution_status": "resolved",
  "keywords": ["keyword1", "keyword2"]
}

Rules:
- summary: key points from the call as bullet points
- action_items: specific follow-up tasks identified, empty array if none
- sentiment_timeline: one entry every 2-3 minutes, score 1-10 (1=very negative, 10=very positive)
- overall_sentiment: integer 1-10
- predicted_csat: integer 1-5
- resolution_status: one of "resolved", "unresolved", "escalated", "follow-up"
- keywords: important topics mentioned (max 8)`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function runSessionIntelligence(sessionId) {
  console.log(`Starting intelligence pipeline for session: ${sessionId}`);

  // Mark as processing
  await db.query(
    `INSERT INTO session_intelligence (session_id, processing_status)
     VALUES ($1, 'processing')
     ON CONFLICT (session_id) DO UPDATE SET processing_status = 'processing'`,
    [sessionId]
  );

  try {
    // Get recording if available
    const recordingResult = await db.query(
      `SELECT file_path FROM recordings WHERE session_id = $1 AND status = 'ready' LIMIT 1`,
      [sessionId]
    );

    // Get chat messages
    const chatResult = await db.query(
      `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    let transcript = '';

    if (recordingResult.rows[0]?.file_path) {
      try {
        transcript = await transcribeAudio(recordingResult.rows[0].file_path);
      } catch (err) {
        console.warn('Transcription failed, using chat-only analysis:', err.message);
        transcript = '(Audio transcription unavailable — analysis based on chat only)';
      }
    } else {
      transcript = '(No recording available — analysis based on chat messages only)';
    }

    // Run analysis
    const analysis = await analyzeWithGemini(transcript, chatResult.rows);

    // Save results
    await db.query(
      `UPDATE session_intelligence SET
         transcript = $1,
         summary = $2,
         action_items = $3,
         sentiment_timeline = $4,
         overall_sentiment = $5,
         predicted_csat = $6,
         resolution_status = $7,
         keywords = $8,
         processing_status = 'done'
       WHERE session_id = $9`,
      [
        transcript,
        analysis.summary,
        JSON.stringify(analysis.action_items),
        JSON.stringify(analysis.sentiment_timeline),
        analysis.overall_sentiment,
        analysis.predicted_csat,
        analysis.resolution_status,
        analysis.keywords,
        sessionId,
      ]
    );

    console.log(`Intelligence pipeline complete for session: ${sessionId}`);
    return analysis;
  } catch (err) {
    console.error('Intelligence pipeline error:', err);
    await db.query(
      `UPDATE session_intelligence SET processing_status = 'failed' WHERE session_id = $1`,
      [sessionId]
    );
    throw err;
  }
}

module.exports = { runSessionIntelligence };
