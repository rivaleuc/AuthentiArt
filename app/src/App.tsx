import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Wallet, Loader2, Plus, Search, Stamp, ShieldCheck, ShieldX, HelpCircle } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const DISP = { fontFamily: 'Playfair Display, Georgia, serif' }
type Item = { id: string; submitter: string; title: string; creator: string; provenance_url: string; state: string; verdict: string; confidence: number; reason: string }
const seal = (v: string) => v === 'authentic' ? { c: '#34d399', I: ShieldCheck, t: 'authentic' } : v === 'forgery' ? { c: '#fb7185', I: ShieldX, t: 'forgery' } : { c: '#fbbf24', I: HelpCircle, t: 'inconclusive' }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_items: 0, authentic: 0 })
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(''); const [creator, setCreator] = useState(''); const [prov, setProv] = useState('')
  const [qt, setQt] = useState(''); const [qc, setQc] = useState(''); const [hit, setHit] = useState<any>(null)
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_items: Number(s?.total_items ?? 0), authentic: Number(s?.authentic ?? 0) })
      const total = Number(s?.total_items ?? 0); const out: Item[] = []
      for (let i = total - 1; i >= 0 && i >= total - 24; i--) { try { const it = (await read('get_item', [String(i)])) as any; if (it?.exists) out.push({ ...it, id: String(i) }) } catch {} }
      setItems(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function submit() { if (!title.trim() || !creator.trim() || !prov.trim()) return toast.error('Title, creator, provenance.'); setCreating(true); const t = toast.loading('Hanging the piece…'); try { await write('submit_item', [title.trim(), creator.trim(), prov.trim()]); toast.success('Added to the wall.', { id: t }); setTitle(''); setCreator(''); setProv(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function authenticate(it: Item) { setBusy(it.id); const t = toast.loading('Examining provenance… (30–60s)'); try { await write('authenticate', [it.id]); const x = (await read('get_item', [it.id])) as any; toast.success(String(x?.verdict).toUpperCase(), { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function lookup() { if (!qt.trim() || !qc.trim()) return toast.error('Title + creator.'); setHit(null); try { setHit(await read('lookup', [qt.trim(), qc.trim()])) } catch (e: any) { toast.error(`Lookup failed: ${e?.message ?? e}`) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="light" position="top-center" richColors />
      {/* centered museum masthead — no top bar */}
      <header className="mx-auto max-w-3xl px-5 pt-12 text-center">
        <div className="text-[11px] uppercase tracking-[0.4em] text-muted">The Consensus Collection · Bradbury</div>
        <h1 className="mt-3 text-5xl font-extrabold tracking-tight md:text-6xl" style={DISP}>AuthentiArt</h1>
        <p className="mx-auto mt-2 max-w-md text-sm italic text-muted" style={DISP}>Provenance, authenticated by validator consensus — every piece sealed on-chain.</p>
        <div className="mx-auto mt-5 h-px w-40 bg-border" />
        <div className="mt-4 flex items-center justify-center gap-2 text-xs">
          <span className="text-muted">{stats.total_items} pieces · {stats.authentic} authentic</span>
          <span className="text-border">·</span>
          <button onClick={connect} className="text-primary hover:underline">{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'connected' : 'connect wallet'}</button>
          <span className="text-border">·</span>
          <button onClick={() => setOpen(!open)} className="text-primary hover:underline">submit a piece</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {/* lookup desk */}
        <div className="mx-auto mb-6 flex max-w-md items-center gap-1.5 rounded-full border border-border bg-card/70 p-1.5">
          <Search className="ml-2 h-4 w-4 text-muted" /><input value={qt} onChange={(e) => setQt(e.target.value)} placeholder="title" className="w-28 bg-transparent text-sm outline-none" /><input value={qc} onChange={(e) => setQc(e.target.value)} placeholder="creator" className="w-28 bg-transparent text-sm outline-none" /><Button size="sm" onClick={lookup}>Verify</Button>
        </div>
        <AnimatePresence>{hit && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto mb-5 flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm"><Stamp className="h-4 w-4" style={{ color: hit.known ? seal(hit.verdict).c : '#999' }} /><span>{qt} · {qc}</span><span className="ml-auto font-semibold uppercase" style={{ color: hit.known ? seal(hit.verdict).c : '#999' }}>{hit.known ? `${hit.verdict} (${hit.confidence}%)` : 'not in registry'}</span></motion.div>}</AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mx-auto mb-6 grid max-w-2xl gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60" />
              <input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Creator" className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60" />
              <input value={prov} onChange={(e) => setProv(e.target.value)} placeholder="Provenance URL" className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/60" />
              <Button size="sm" onClick={submit} disabled={creating} className="sm:col-span-3 sm:justify-self-end">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Hang on wall</Button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {items.length === 0 && <div className="col-span-full py-12 text-center text-sm text-muted" style={DISP}>The wall is empty.</div>}
          {items.map((it) => {
            const done = it.state === 'authenticated'; const sl = seal(it.verdict); const I = sl.I
            return (
              <motion.div key={it.id} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="relative rounded-sm p-2 shadow-xl" style={{ background: 'linear-gradient(145deg,#4a3a1e,#251c10)', border: '3px solid #6b5832' }}>
                  <div className="flex aspect-[4/5] flex-col rounded-sm border border-[#6b5832]/60 bg-gradient-to-br from-[#fbf7ee] to-[#efe7d6] p-3">
                    <div className="grid flex-1 place-items-center">
                      {done ? <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: `${sl.c}1f`, border: `2px solid ${sl.c}` }}><I className="h-7 w-7" style={{ color: sl.c }} /></span>
                        : <button onClick={() => authenticate(it)} disabled={busy === it.id} className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-[#9a6b15]/50 text-[#9a6b15] hover:bg-[#9a6b15]/10">{busy === it.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Stamp className="h-6 w-6" />}</button>}
                    </div>
                    <div className="rounded-sm bg-[#2a2118] px-2 py-1.5 text-center">
                      <div className="truncate text-sm font-semibold text-[#f3ede0]" style={DISP}>{it.title}</div>
                      <div className="truncate text-[11px] italic text-[#c9b78f]">{it.creator}</div>
                    </div>
                  </div>
                  {done && <div className="absolute -right-2 -top-2 rotate-12 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white" style={{ background: sl.c }}>{sl.t} {it.confidence}%</div>}
                </div>
              </motion.div>
            )
          })}
        </div>
        <div className="mt-10 text-center text-[11px] text-muted"><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">contract {short(CONTRACT)} ↗</a></div>
      </main>
    </div>
  )
}
