import { ChangeEvent, ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { api, Contact, Message } from "../api";
import { useAuth } from "../auth";
import { resizeDataUrl, resizeImageToDataUrl, userAvatarColor, userInitials } from "../userDisplay";
import { ArrowBackIcon, AttachIcon, CameraIcon, CloseIcon, SendIcon } from "./Icon";

interface Props {
  onClose: () => void;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function previewText(m: Message | null): string {
  if (!m) return "No messages yet";
  if (m.body) return m.body;
  if (m.image) return "📷 Photo";
  return "";
}

/**
 * Screen-capture screenshot tool: uses the real browser Screen Capture API
 * (getDisplayMedia) rather than faking it — the user picks a tab/window/
 * screen via the browser's own picker, we grab a single frame from that
 * stream onto a canvas, then immediately stop the stream so the "sharing"
 * indicator disappears right away.
 */
async function captureScreenshot(): Promise<string> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Let at least one real frame render before grabbing it.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export function Messenger({ onClose }: Props) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  function loadContacts() {
    api.listContacts().then(setContacts).catch(() => {});
  }

  useEffect(() => {
    loadContacts();
  }, []);

  // Refresh the contact list (unread badges, last-message previews) while browsing it.
  useEffect(() => {
    if (activeContact) return;
    const t = setInterval(loadContacts, 5000);
    return () => clearInterval(t);
  }, [activeContact]);

  // Poll the open thread for new messages; each fetch also marks their messages as read server-side.
  useEffect(() => {
    if (!activeContact) return;
    let cancelled = false;
    function load() {
      api.getThread(activeContact!.id).then((msgs) => {
        if (!cancelled) setMessages(msgs);
      });
    }
    load();
    const t = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeContact]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
  }, [messages]);

  function openContact(c: Contact) {
    setActiveContact(c);
    setMessages([]);
    setDraft("");
    setPendingImage(null);
  }

  function backToList() {
    setActiveContact(null);
    loadContacts();
  }

  async function send() {
    if (!activeContact || sending) return;
    if (!draft.trim() && !pendingImage) return;
    setSending(true);
    try {
      const message = await api.sendMessage(activeContact.id, { body: draft.trim() || undefined, image: pendingImage || undefined });
      setMessages((prev) => [...prev, message]);
      setDraft("");
      setPendingImage(null);
    } finally {
      setSending(false);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function onFilePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingImage(await resizeImageToDataUrl(file, 1600));
  }

  async function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (file) setPendingImage(await resizeImageToDataUrl(file, 1600));
  }

  async function onScreenshot() {
    setCapturing(true);
    try {
      const raw = await captureScreenshot();
      setPendingImage(await resizeDataUrl(raw, 1600));
    } catch {
      // Picker cancelled or capture blocked — nothing to attach, nothing to report.
    } finally {
      setCapturing(false);
    }
  }

  const filteredContacts = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.first_name} ${c.last_name} ${c.login} ${c.company ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="messenger-overlay" onClick={onClose}>
      <div className="messenger-panel" onClick={(e) => e.stopPropagation()}>
        {!activeContact ? (
          <>
            <div className="messenger-header">
              <div className="messenger-title" style={{ flex: 1 }}>Messages</div>
              <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="messenger-search">
              <input placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="messenger-contacts">
              {filteredContacts.map((c) => (
                <button type="button" key={c.id} className="messenger-contact-row" onClick={() => openContact(c)}>
                  <span
                    className="messenger-avatar"
                    style={c.avatar ? undefined : { background: userAvatarColor(c) }}
                  >
                    {c.avatar ? <img src={c.avatar} alt="" /> : userInitials(c)}
                  </span>
                  <span className="messenger-contact-info">
                    <span className="messenger-contact-name">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="messenger-contact-preview">{previewText(c.lastMessage)}</span>
                  </span>
                  <span className="messenger-contact-meta">
                    {c.lastMessage && <span className="messenger-contact-time">{timeLabel(c.lastMessage.created_at)}</span>}
                    {c.unreadCount > 0 && <span className="messenger-unread-dot">{c.unreadCount}</span>}
                  </span>
                </button>
              ))}
              {filteredContacts.length === 0 && (
                <div className="messenger-empty">
                  {contacts.length === 0 ? "No other users yet — ask your superadmin to create accounts." : "No matches."}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="messenger-header">
              <button type="button" className="icon-button" onClick={backToList} aria-label="Back">
                <ArrowBackIcon size={18} />
              </button>
              <span
                className="messenger-avatar small"
                style={activeContact.avatar ? undefined : { background: userAvatarColor(activeContact) }}
              >
                {activeContact.avatar ? <img src={activeContact.avatar} alt="" /> : userInitials(activeContact)}
              </span>
              <div className="messenger-title" style={{ flex: 1 }}>
                {activeContact.first_name} {activeContact.last_name}
              </div>
              <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="messenger-messages" ref={messagesRef}>
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`messenger-bubble-row ${mine ? "mine" : ""}`}>
                    <div className="messenger-bubble">
                      {m.image && (
                        <img
                          className="messenger-bubble-image"
                          src={m.image}
                          alt=""
                          onClick={() => setLightbox(m.image)}
                        />
                      )}
                      {m.body && <div className="messenger-bubble-text">{m.body}</div>}
                      <div className="messenger-bubble-time">{timeLabel(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <div className="messenger-empty">Say hello 👋</div>}
            </div>

            <div className="messenger-composer">
              {pendingImage && (
                <div className="messenger-pending-image">
                  <img src={pendingImage} alt="" />
                  <button type="button" className="messenger-pending-remove" onClick={() => setPendingImage(null)} aria-label="Remove image">
                    <CloseIcon size={12} />
                  </button>
                </div>
              )}
              <div className="messenger-composer-row">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  onPaste={onPaste}
                  placeholder="Write a message…"
                  rows={1}
                />
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFilePick} />
                <button type="button" className="icon-button" title="Attach image" onClick={() => fileInputRef.current?.click()}>
                  <AttachIcon size={18} />
                </button>
                <button type="button" className="icon-button" title="Take a screenshot" disabled={capturing} onClick={onScreenshot}>
                  <CameraIcon size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button messenger-send"
                  title="Send"
                  disabled={sending || (!draft.trim() && !pendingImage)}
                  onClick={send}
                >
                  <SendIcon size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {lightbox && (
        <div
          className="messenger-lightbox"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
