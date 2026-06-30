import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  BadgeCheck, Wallet, Loader2, Plus, Search, ShieldCheck, ShieldX, HelpCircle, Stamp,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Item = { id: string; submitter: string; title: string; creator: string; provenance_url: string; state: string; verdict: string; confidence: number; reason: string }

const seal = (v: string) => v === 'authentic' ? { c: 'text-true border-true/40 bg-true/10', I: ShieldCheck } : v === 'forgery' ? { c: 'text-false border-false/40 bg-false/10', I: ShieldX } : { c: 'text-unverifiable border-unverifiable/40 bg-unverifiable/10', I: HelpCircle }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_items: 0, authentic: 0 })
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(''); const [creator, setCreator] = useState(''); const [prov, setProv] = useState('')
  const [qt, setQt] = useState(''); const [qc, setQc] = useState(''); const [hit, setHit] = useState<any>(null); const [looking, setLooking] = useState(false)
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_items: Number(s?.total_items ?? 0), authentic: Number(s?.authentic ?? 0) })
      const total = Number(s?.total_items ?? 0); const out: Item[] = []
      for (let i = total - 1; i >= 0 && i >= total - 12; i--) { try { const it = (await read('get_item', [String(i)])) as any; if (it?.exists) out.push({ ...it, id: String(i) }) } catch {} }
      setItems(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function submit() { if (!title.trim() || !creator.trim() || !prov.trim()) return toast.error('Title, creator, provenance URL.'); setCreating(true); const t = toast.loading('Submitting…'); try { await write('submit_item', [title.trim(), creator.trim(), prov.trim()]); toast.success('Submitted.', { id: t }); setTitle(''); setCreator(''); setProv(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function authenticate(it: Item) { setBusy(it.id); const t = toast.loading('Validators examining provenance… (30–60s)'); try { await write('authenticate', [it.id]); const x = (await read('get_item', [it.id])) as any; toast.success(`Verdict: ${String(x?.verdict).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function lookup() { if (!qt.trim() || !qc.trim()) return toast.error('Title + creator.'); setLooking(true); setHit(null); try { setHit(await read('lookup', [qt.trim(), qc.trim()])) } catch (e: any) { toast.error(`Lookup failed: ${e?.message ?? e}`) } finally { setLooking(false) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#e0b34118,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-5">
          <BadgeCheck className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">AuthentiArt</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_items} /></b> items · <b className="text-true"><NumberTicker value={stats.authentic} /></b> authentic</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Provenance, authenticated on-chain</h1>
            <p className="mt-1 text-sm text-muted">Validators examine the provenance and agree on a verdict — then anyone can verify before they buy.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card/60 p-1.5">
            <Search className="ml-1.5 h-4 w-4 text-muted" />
            <input value={qt} onChange={(e) => setQt(e.target.value)} placeholder="title" className="w-24 bg-transparent text-sm outline-none" />
            <input value={qc} onChange={(e) => setQc(e.target.value)} placeholder="creator" className="w-24 bg-transparent text-sm outline-none" />
            <Button size="sm" onClick={lookup} disabled={looking}>{looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
          </div>
        </div>

        <AnimatePresence>
          {hit && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-3 flex items-center gap-3 rounded-xl border p-3 text-sm ${hit.known ? seal(hit.verdict).c : 'border-border bg-card/50 text-muted'}`}>
              <Stamp className="h-4 w-4" />
              <span className="font-medium">{qt} · {qc}</span>
              <span className="ml-auto font-semibold uppercase">{hit.known ? `${hit.verdict} (${hit.confidence}%)` : 'not in registry'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Submit an item'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3 sm:grid-cols-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Creator / artist" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <input value={prov} onChange={(e) => setProv(e.target.value)} placeholder="Provenance URL" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50 sm:col-span-2" />
              <Button size="sm" onClick={submit} disabled={creating} className="sm:col-span-2 sm:justify-self-end">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Submit</Button>
            </div>
          </motion.div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No items yet.</div>}
          {items.map((it) => {
            const done = it.state === 'authenticated'; const sl = seal(it.verdict); const I = sl.I
            return (
              <motion.div key={it.id} initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col rounded-2xl border border-border bg-card/55 p-4">
                <div className="flex items-start justify-between">
                  <div><div className="font-semibold leading-tight">{it.title}</div><div className="text-xs text-muted">{it.creator}</div></div>
                  {done && <span className={`grid h-9 w-9 place-items-center rounded-full border ${sl.c}`}><I className="h-4 w-4" /></span>}
                </div>
                {done ? (
                  <div className="mt-3">
                    <div className={`inline-block rounded border px-2 py-0.5 text-[11px] font-bold uppercase ${sl.c}`}>{it.verdict} · {it.confidence}%</div>
                    {it.reason && <p className="mt-1.5 line-clamp-2 text-[11px] text-muted">{it.reason}</p>}
                  </div>
                ) : (
                  <Button size="sm" className="mt-3" disabled={busy === it.id} onClick={() => authenticate(it)}>{busy === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Authenticate</Button>
                )}
              </motion.div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-muted"><span>AuthentiArt · provenance authentication registry on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
