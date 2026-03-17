import { useState } from 'react';
import type { FormEvent } from 'react';
import PublicLegalLayout from './PublicLegalLayout';
import { API_BASE_URL } from '../../lib/apiBase';

const LAST_UPDATED = '2026-03-05';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [modal, setModal] = useState<'success' | 'error' | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');

    try {
      const response = await fetch(`${API_BASE_URL}/v1/public/contact`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        setStatus('error');
        setModal('error');
        return;
      }

      setStatus('sent');
      setName('');
      setEmail('');
      setMessage('');
      setModal('success');
    } catch {
      setStatus('error');
      setModal('error');
    }
  };

  return (
    <PublicLegalLayout
      title="Contact"
      lastUpdated={LAST_UPDATED}
      canonicalPath="/contact"
      metaDescription="Contact Sonus support for account help, privacy requests, and product feedback."
    >
      <section>
        <h2 className="main-font text-title-page text-[var(--sonus-palette-charcoal)] sm:text-3xl">Get in Touch</h2>
        <p className="mt-2">
          For support, product feedback, or account requests, email us at{' '}
          <a className="underline underline-offset-4" href="mailto:support@sonuslearning.com">
            support@sonuslearning.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="main-font text-title-page text-[var(--sonus-palette-charcoal)] sm:text-3xl">Contact Form</h2>
        <p className="mt-2">Send your message directly to our support inbox.</p>
        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <label className="text-sm text-[var(--sonus-palette-charcoal)]">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm outline-none focus:border-[#4C5A6A]"
              placeholder="Your name"
              required
            />
          </label>
          <label className="text-sm text-[var(--sonus-palette-charcoal)]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm outline-none focus:border-[#4C5A6A]"
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="text-sm text-[var(--sonus-palette-charcoal)]">
            Message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-1 min-h-28 w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm outline-none focus:border-[#4C5A6A]"
              placeholder="How can we help?"
              required
            />
          </label>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-fit rounded-xl border border-[#4C5A6A] bg-[var(--sonus-palette-charcoal)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === 'sending' ? 'Sending...' : 'Send'}
          </button>
        </form>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1220]/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-[#CBD5E1] bg-white p-5 shadow-xl"
          >
            <h2 className="main-font text-title-page text-[var(--sonus-palette-charcoal)]">
              {modal === 'success' ? 'Message Sent' : 'Message Not Sent'}
            </h2>
            <p className="mt-2 text-sm text-[#334155]">
              {modal === 'success'
                ? 'Thank you for contacting Sonus. Your message has been sent successfully, and our team will respond as soon as possible.'
                : 'We were unable to send your message at this time. Please try again in a moment.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setModal(null);
                if (status !== 'sending') setStatus('idle');
              }}
              className="mt-5 rounded-xl border border-[#4C5A6A] bg-[var(--sonus-palette-charcoal)] px-4 py-2 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </PublicLegalLayout>
  );
}
