import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, FileText, Download } from 'lucide-react';
import { getSocket } from '../socket';
import api from '../api';

export default function ChatPanel({ sessionId, messages, myRole, myName, isAgent }) {
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!inputText.trim()) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('send-message', {
      sessionId,
      content: inputText.trim(),
      messageType: 'text',
    }, (res) => {
      if (res.error) {
        console.error('Failed to send message:', res.error);
      } else {
        setInputText('');
      }
    });
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Notify the server about the uploaded file message over socket
      const socket = getSocket();
      socket?.emit('send-message', {
        sessionId,
        content: `Shared a file: ${file.name}`,
        messageType: 'file',
        fileUrl: data.message.file_url || data.fileUrl,
        fileName: file.name,
        fileSize: file.size,
      }, (res) => {
        if (res.error) console.error('Socket notification for upload failed:', res.error);
      });

    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-background)' }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Session Chat
        </h3>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            No messages yet. Send a message below.
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_name === myName || msg.sender_role === myRole;
          return (
            <div
              key={msg.id || i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                alignSelf: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              {/* Sender label */}
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px', fontWeight: 500 }}>
                {msg.sender_name} ({msg.sender_role})
              </span>

              {/* Message bubble */}
              {msg.message_type === 'file' || msg.file_url ? (
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-lg)',
                  background: isMe ? 'var(--color-surface-raised)' : 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <FileText size={20} style={{ color: 'var(--color-text-secondary)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-all' }}>
                      {msg.file_name || msg.content}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {msg.file_size ? formatBytes(msg.file_size) : ''}
                    </span>
                  </div>
                  <a
                    href={msg.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={msg.file_name || 'download'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Download size={16} />
                  </a>
                </div>
              ) : (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-lg)',
                  background: isMe ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                  color: isMe ? '#ffffff' : 'var(--color-text-primary)',
                  fontSize: '13px',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        borderTop: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {uploadError && (
          <div style={{
            fontSize: '12px',
            color: 'var(--color-danger)',
            background: 'var(--color-danger-bg)',
            padding: '4px 8px',
            borderRadius: '4px',
            marginBottom: 'var(--space-2)',
          }}>
            {uploadError}
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* File upload trigger */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Paperclip size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Text input */}
          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={uploading ? 'Uploading file…' : 'Type a message…'}
            disabled={uploading}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              background: 'var(--color-background)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!inputText.trim() || uploading}
            style={{
              background: 'var(--color-accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputText.trim() ? 'pointer' : 'default',
              opacity: inputText.trim() ? 1 : 0.5,
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
