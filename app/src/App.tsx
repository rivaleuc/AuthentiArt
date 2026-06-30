import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { BadgeCheck, Wallet, Loader2, Plus, Search, Stamp, ShieldCheck, ShieldX, HelpCircle } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
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
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#e0b34118,transparent_55%)]" />
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-6xl items-center gap-2.5 px-5">
        <BadgeCheck className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>AuthentiArt</span>
        <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_items} /></b> pieces · <b className="text-true"><NumberTicker value={stats.authentic} /></b> authentic</div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-border bg-card/60 p-1.5">
          <Search className="ml-1.5 h-4 w-4 text-muted" /><input value={qt} onChange={(e) => setQt(e.target.value)} placeholder="title" className="w-20 bg-transparent text-sm outline-none" /><input value={qc} onChange={(e) => setQc(e.target.value)} placeholder="creator" className="w-20 bg-transparent text-sm outline-none" /><Button size="sm" onClick={lookup}><Search className="h-4 w-4" /></Button>
        </div>
        <Button size="sm" className="ml-2" variant="outline" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /></Button>
        <Button size="sm" className="ml-2" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
      </div></header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <AnimatePresence>{hit && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 text-sm"><Stamp className="h-4 w-4" style={{ color: hit.known ? seal(hit.verdict).c : '#888' }} /><span>{qt} · {qc}</span><span className="ml-auto font-semibold uppercase" style={{ color: hit.known ? seal(hit.verdict).c : '#888' }}>{hit.known ? `${hit.verdict} (${hit.confidence}%)` : 'not in registry'}</span></motion.div>}</AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mb-6 grid gap-2 rounded-xl border border-border bg-card/60 p-3 sm:grid-cols-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Creator" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={prov} onChange={(e) => setProv(e.target.value)} placeholder="Provenance URL" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <Button size="sm" onClick={submit} disabled={creating} className="sm:col-span-3 sm:justify-self-end">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Hang on wall</Button>
            </div>
          </motion.div>
        )}

        {/* gallery wall */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">The wall is empty.</div>}
          {items.map((it) => {
            const done = it.state === 'authenticated'; const sl = seal(it.verdict); const I = sl.I
            return (
              <motion.div key={it.id} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} className="group">
                {/* frame */}
                <div className="relative rounded-sm p-2 shadow-2xl" style={{ background: 'linear-gradient(145deg,#3a2f1a,#1b150c)', border: '3px solid #5b4a28' }}>
                  <div className="aspect-[4/5] rounded-sm border border-[#5b4a28]/60 bg-gradient-to-br from-[#14110c] to-[#0c0a07] p-3 flex flex-col">
                    <div className="flex-1 grid place-items-center">
                      {done ? <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: `${sl.c}1a`, border: `2px solid ${sl.c}` }}><I className="h-7 w-7" style={{ color: sl.c }} /></span>
                        : <button onClick={() => authenticate(it)} disabled={busy === it.id} className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-muted/40 text-muted hover:border-primary hover:text-primary">{busy === it.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Stamp className="h-6 w-6" />}</button>}
                    </div>
                    {/* placard */}
                    <div className="rounded-sm bg-[#0c0a07]/80 px-2 py-1.5 text-center">
                      <div className="truncate text-sm font-semibold" style={{ fontFamily: 'Georgia, serif' }}>{it.title}</div>
                      <div className="truncate text-[11px] italic text-muted">{it.creator}</div>
                    </div>
                  </div>
                  {done && <div className="absolute -right-2 -top-2 rotate-12 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: sl.c, color: '#0c0a07' }}>{sl.t} {it.confidence}%</div>}
                </div>
                {done && it.reason && <p className="mt-1.5 line-clamp-2 px-1 text-[10px] text-muted">{it.reason}</p>}
              </motion.div>
            )
          })}
        </div>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-xs text-muted"><span>AuthentiArt · provenance authenticated by consensus</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
