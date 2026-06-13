import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function IntelligenceCard({ intelligence }) {
  const timeline = intelligence.sentiment_timeline || [];
  const actionItems = intelligence.action_items || [];
  const keywords = intelligence.keywords || [];

  const csatColor = intelligence.predicted_csat >= 4
    ? 'var(--color-success)'
    : intelligence.predicted_csat >= 3
    ? 'var(--color-warning)'
    : 'var(--color-danger)';

  return (
    <div style={{ overflowY: 'auto', padding: 'var(--space-5)', height: '100%' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
        Session analysis
      </h3>

      {/* CSAT + Sentiment row */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <div style={{
          flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: csatColor }}>
            {intelligence.predicted_csat}/5
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Predicted CSAT
          </div>
        </div>
        <div style={{
          flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>
            {intelligence.overall_sentiment}/10
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Sentiment score
          </div>
        </div>
      </div>

      {/* Resolution status */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px',
          borderRadius: '12px', fontSize: '12px', fontWeight: 500,
          background: intelligence.resolution_status === 'resolved'
            ? 'var(--color-success-bg)' : 'var(--color-surface-raised)',
          color: intelligence.resolution_status === 'resolved'
            ? 'var(--color-success)' : 'var(--color-text-secondary)',
        }}>
          Status: {intelligence.resolution_status || 'Unknown'}
        </span>
      </div>

      {/* Sentiment timeline chart */}
      {timeline.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            SENTIMENT OVER CALL
          </div>
          <div style={{ width: '100%', height: 80 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <XAxis dataKey="minute" tick={{ fontSize: 10 }} tickFormatter={v => `${v}m`} />
                <YAxis domain={[1, 10]} hide />
                <Tooltip
                  formatter={(val, _, props) => [val, props.payload.note || 'Sentiment']}
                  labelFormatter={v => `Minute ${v}`}
                />
                <Line
                  type="monotone" dataKey="score" stroke="#2563EB"
                  strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary */}
      {intelligence.summary && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            SUMMARY
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {intelligence.summary}
          </div>
        </div>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            ACTION ITEMS
          </div>
          {actionItems.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
              marginBottom: 'var(--space-2)', fontSize: '13px',
            }}>
              <input type="checkbox" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Keywords */}
      {keywords.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
            TOPICS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {keywords.map((kw, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: '12px',
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                fontSize: '12px', color: 'var(--color-text-secondary)',
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
