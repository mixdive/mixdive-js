// Sandbox only: the panel listing what the SDK sent.
import { DELIVER, SERVER } from './config'
import { useSent } from './recorder'

function label(path: string, body: Record<string, unknown>): string {
  if (path.endsWith('/user')) return `profile ${body.user_id}`
  return String(body.event_key)
}

export function SentPanel() {
  const sent = useSent()
  return (
    <aside>
      <h2>What the SDK sent</h2>
      <p className="note">
        {DELIVER ? `Delivered to ${SERVER}.` : 'Kept in this page. Set SERVER and API_KEY in src/config.ts to deliver.'}
      </p>
      {sent.length === 0 && <p className="note">Nothing yet.</p>}
      {sent.map((s) => (
        <details key={s.n}>
          <summary>
            <code>{label(s.path, s.body)}</code>
            <span>
              POST {s.path} · {s.at.toLocaleTimeString()}
            </span>
          </summary>
          <pre>{JSON.stringify(s.body, null, 2)}</pre>
        </details>
      ))}
    </aside>
  )
}
