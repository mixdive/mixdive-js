import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { useMixdive } from '@mixdive/react'
import { SentPanel } from './SentPanel'

const PRODUCTS = [
  { id: 'mug', name: 'Enamel mug', price: 18 },
  { id: 'tote', name: 'Canvas tote', price: 24 },
  { id: 'cap', name: 'Wool cap', price: 32 },
]

// A two-page app with pushState links. Mixdive picks up every navigation on
// its own, the same way it does under React Router or Next.js.
function usePath(): string {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('popstate', l)
      return () => window.removeEventListener('popstate', l)
    },
    () => location.pathname,
  )
}

function Link({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault()
        history.pushState(null, '', to)
        dispatchEvent(new PopStateEvent('popstate'))
      }}
    >
      {children}
    </a>
  )
}

export function App() {
  const mixdive = useMixdive()
  const path = usePath()
  const [cart, setCart] = useState<string[]>([])
  const [user, setUser] = useState<string | null>(null)

  const add = (id: string) => {
    setCart((c) => [...c, id])
    mixdive.track('add_to_cart', { product: id })
  }

  const checkout = () => {
    const total = cart.reduce((sum, id) => sum + PRODUCTS.find((p) => p.id === id)!.price, 0)
    // sum is a measure: Mixdive adds it up per day, beside the event count.
    mixdive.track('checkout_completed', { items: cart.length }, { sum: total })
    setCart([])
  }

  const signIn = () => {
    mixdive.setUser('user_42', { name: 'Ada Lovelace', email: 'ada@example.com' })
    mixdive.login('email')
    setUser('Ada')
  }

  const signOut = () => {
    mixdive.reset() // the next person at this browser is a new visitor
    setUser(null)
  }

  return (
    <div className="layout">
      <main>
        <nav>
          <Link to="/">Shop</Link>
          <Link to="/cart">Cart ({cart.length})</Link>
          <span className="spacer" />
          {user ? (
            <button onClick={signOut}>Sign out {user}</button>
          ) : (
            <button onClick={signIn}>Sign in</button>
          )}
        </nav>

        {path === '/cart' ? (
          <section>
            <h1>Your cart</h1>
            {cart.length === 0 ? (
              <p>Empty. Add something from the shop.</p>
            ) : (
              <>
                <ul>
                  {cart.map((id, i) => (
                    <li key={i}>{PRODUCTS.find((p) => p.id === id)!.name}</li>
                  ))}
                </ul>
                <button className="primary" onClick={checkout}>
                  Check out
                </button>
              </>
            )}
          </section>
        ) : (
          <section>
            <h1>Shop</h1>
            <div className="grid">
              {PRODUCTS.map((p) => (
                <div className="card" key={p.id}>
                  <strong>{p.name}</strong>
                  <span>${p.price}</span>
                  <button onClick={() => add(p.id)}>Add to cart</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <SentPanel />
    </div>
  )
}
