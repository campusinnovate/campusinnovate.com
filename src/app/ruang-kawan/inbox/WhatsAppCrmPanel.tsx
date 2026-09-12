'use client';

import Link from 'next/link';
import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FiEdit3, FiExternalLink, FiLink, FiPlus, FiRefreshCw, FiX, FiTag, FiAward, FiZap, FiUsers, FiSend, FiArrowRight, FiInfo } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';
import styles from './inbox.module.css';

type Contact = { id: string; phone: string; name: string; organization: string; email: string; role: string; notes: string; updated_at: string };
type ContactForm = Pick<Contact, 'name' | 'organization' | 'email' | 'role' | 'notes'>;
type Config = { stages?: string[]; priorities?: string[]; activity_types?: string[]; business_units?: string[] };
type Source = { id: string; name: string; module_type: string; module_config: Config; color?: string };
type Member = { id: string; name: string };
type Lead = {
  id: string; source_id: string; source_name: string; source_color: string; source_config: Config; lead_code: string;
  account_name: string; contact_name: string | null; contact_details: string | null; stage: string;
  next_action: string; due_date: string; last_contact_date: string | null;
  owner_membership_id: string; owner_name: string; workflow_status?: string; progress?: number;
  extra_data?: Record<string, unknown>;
};
type Context = { 
  contact: Contact; 
  linked_lead: Lead | null; 
  has_linked_lead: boolean; 
  matching_leads?: Lead[];
  conversation?: { 
    lead_score: number; 
    score_breakdown: Record<string, unknown>;
    reference_code: string;
    tags: string[];
    assigned_membership_id: string | null;
    attribution?: { utm_source: string; utm_medium: string; utm_campaign: string; referrer: string; landing_page: string };
  };
};
type LeadForm = { 
  source_id: string; owner_membership_id: string; account_name: string; stage: string; 
  priority: string; activity_type: string; next_action: string; due_date: string;
  business_unit?: string;
};
type QuickReply = { id: string; shortcut: string; content: string; description?: string };
type Template = { id: string; name: string; category: string; header_text?: string; body_text: string; footer_text?: string; buttons?: unknown[]; meta_template_name: string; language: string };
type Attribution = { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string; referrer?: string; landing_page?: string };

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const emptyContact: ContactForm = { name: '', organization: '', email: '', role: '', notes: '' };
const emptyLead = (): LeadForm => ({ source_id: '', owner_membership_id: '', account_name: '', stage: '', priority: '', activity_type: '', next_action: 'Tindak lanjuti kebutuhan pelanggan WhatsApp', due_date: today(), business_unit: '' });
const defaults = (source?: Source) => ({ stage: source?.module_config.stages?.[0] ?? '', priority: source?.module_config.priorities?.[0] ?? 'Medium', activity_type: source?.module_config.activity_types?.[0] ?? 'Follow Up', business_unit: source?.module_config.business_units?.[0] ?? '' });

const scoreColor = (score: number) => score >= 70 ? 'var(--score-high)' : score >= 40 ? 'var(--score-med)' : 'var(--score-low)';
const scoreLabel = (score: number) => score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';

export default function WhatsAppCrmPanel({ conversationId, permissions, membershipId, lastIncomingAt }: {
  conversationId: string; permissions: string[]; membershipId: string; lastIncomingAt: string | null;
}) {
  const [context, setContext] = useState<Context | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<'contact' | 'create' | 'followup' | 'tags' | 'transfer' | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const [contactVersion, setContactVersion] = useState('');
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLead);
  const [followup, setFollowup] = useState({ stage: '', next_action: '', due_date: '' });
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [showSmartCreate, setShowSmartCreate] = useState(false);
  const [smartLeadData, setSmartLeadData] = useState<LeadForm | null>(null);
  const mounted = useRef(true);
  const mutationLock = useRef(false);
  const loadSequence = useRef(0);
  const previousIncoming = useRef(lastIncomingAt);
  const editingLeadId = useRef('');
  const canCreate = permissions.includes('pipeline.manage_self');
  const canManageTeam = permissions.includes('pipeline.manage_team');
  const canAssignTeam = canManageTeam || permissions.includes('activity.assign_team');
  const canEditContact = canCreate || canManageTeam;
  const linked = context?.linked_lead;
  const canEditLead = !!linked && (linked.owner_membership_id === membershipId ? canCreate : canManageTeam);
  const canTransfer = canManageTeam || permissions.includes('pipeline.manage_team');

  const load = useCallback(async (withOptions = false) => {
    const sequence = ++loadSequence.current;
    try {
      const db = createClient();
      const [result, sourceResult, memberResult, leadResult, qrResult, tmplResult] = await Promise.all([
        db.rpc('whatsapp_crm_context', { target_conversation_id: conversationId }),
        withOptions ? db.rpc('list_my_work_sources') : Promise.resolve(null),
        withOptions ? db.rpc('list_pipeline_members') : Promise.resolve(null),
        withOptions ? db.rpc('list_pipeline_leads') : Promise.resolve(null),
        withOptions ? db.from('whatsapp_quick_replies').select('*').or(`source_id.is.null,source_id.in.(${sources.map(s => s.id).join(',')})`) : Promise.resolve({ data: null, error: null }),
        withOptions ? db.from('whatsapp_templates').select('*').eq('status', 'approved').or(`source_id.is.null,source_id.in.(${sources.map(s => s.id).join(',')})`) : Promise.resolve({ data: null, error: null }),
      ]);
      if (!mounted.current || sequence !== loadSequence.current) return;
      if (result.error) { setError('Data CRM belum dapat dimuat. Pastikan pembaruan integrasi CRM sudah diaktifkan, lalu coba lagi.'); return; }
      setContext(result.data as Context);
      if (sourceResult && !sourceResult.error) setSources(((sourceResult.data ?? []) as Source[]).filter(s => s.module_type === 'pipeline'));
      if (memberResult && !memberResult.error) setMembers(memberResult.data ?? []);
      if (leadResult && !leadResult.error) setLeads(leadResult.data ?? []);
      if (qrResult.data) setQuickReplies(qrResult.data);
      if (tmplResult.data) setTemplates(tmplResult.data);
      if (sourceResult?.error || memberResult?.error || leadResult?.error) setError('Sebagian pilihan pipeline belum dapat dimuat. Klik perbarui detail untuk mencoba lagi.');
    } catch { if (mounted.current) setError('Koneksi CRM terputus. Coba perbarui detail.'); }
    finally { if (mounted.current && sequence === loadSequence.current) setLoading(false); }
  }, [conversationId, sources]);

  useEffect(() => { mounted.current = true; void load(true); return () => { mounted.current = false; loadSequence.current++; }; }, [load]);
  useEffect(() => {
    if (lastIncomingAt !== previousIncoming.current) { previousIncoming.current = lastIncomingAt; void load(); }
  }, [lastIncomingAt, load]);

  async function mutate(operation: () => PromiseLike<{ error: { message: string } | null }>, success: string) {
    if (mutationLock.current) return;
    mutationLock.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const result = await operation();
      if (!mounted.current) return;
      if (result.error) { setError(result.error.message); return; }
      setEditor(null); setSelectedLead(''); setNotice(success); await load(true);
    } catch { if (mounted.current) setError('Penyimpanan belum terkonfirmasi. Perbarui detail sebelum mencoba lagi.'); }
    finally { mutationLock.current = false; if (mounted.current) setSaving(false); }
  }

  function editContact() {
    if (!context) return;
    const c = context.contact;
    setContactForm({ name: c.name ?? '', organization: c.organization ?? '', email: c.email ?? '', role: c.role ?? '', notes: c.notes ?? '' });
    setContactVersion(c.updated_at); setEditor('contact'); setError(''); setNotice('');
  }

  async function createLeadSmart() {
    if (!context) return;
    const db = createClient();
    const suggestedSource = await db.rpc('suggest_pipeline_source', { conversation_id: conversationId });
    const leadData = await db.rpc('build_lead_from_conversation', { target_conversation_id: conversationId, source_id: suggestedSource.data || sources[0]?.id });
    if (leadData.data) {
      setSmartLeadData(leadData.data);
      setShowSmartCreate(true);
      setEditor('create');
    }
  }

  function createLead() {
    if (!context) return;
    setLeadForm({ ...emptyLead(), source_id: sources[0]?.id ?? '', owner_membership_id: membershipId,
      account_name: context.contact.organization || context.contact.name || `+${context.contact.phone}`, ...defaults(sources[0]) });
    setEditor('create'); setError(''); setNotice('');
  }

  function saveContact(event: FormEvent) {
    event.preventDefault();
    void mutate(() => createClient().rpc('save_whatsapp_crm_contact', { target_conversation_id: conversationId, expected_updated_at: contactVersion, payload: contactForm }), 'Data kontak CRM tersimpan.');
  }

  function saveLead(event: FormEvent) {
    event.preventDefault();
    const payload = showSmartCreate && smartLeadData ? { ...leadForm, ...smartLeadData } : leadForm;
    void mutate(() => createClient().rpc('create_whatsapp_pipeline_lead', { target_conversation_id: conversationId, payload }), 'Lead terhubung. Next action juga tersedia di My Activity milik PIC.');
  }

  function linkLead(event: FormEvent) {
    event.preventDefault();
    if (!selectedLead) return;
    void mutate(() => createClient().rpc('link_whatsapp_pipeline_lead', { target_conversation_id: conversationId, target_lead_id: selectedLead }), 'Percakapan berhasil dikaitkan ke lead pipeline.');
  }

  function saveFollowup(event: FormEvent) {
    event.preventDefault();
    if (!editingLeadId.current) return;
    void mutate(() => createClient().rpc('quick_update_pipeline_lead', { target_pipeline_lead_id: editingLeadId.current, target_stage: followup.stage, target_next_action: followup.next_action, target_due_date: followup.due_date }), 'Stage dan tindak lanjut tersimpan di Pipeline BD dan My Activity.');
  }

  function saveTags(event: FormEvent) {
    event.preventDefault();
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    void mutate(() => createClient().rpc('update_whatsapp_conversation_tags', { target_conversation_id: conversationId, new_tags: tags }), 'Tag percakapan diperbarui.');
  }

  function saveTransfer(event: FormEvent) {
    event.preventDefault();
    if (!transferTargetId) return;
    void mutate(() => createClient().rpc('transfer_whatsapp_conversation', { target_conversation_id: conversationId, new_owner_id: transferTargetId, transfer_note: transferNote }), 'Percakapan berhasil dialihkan.');
  }

  const candidates = leads.filter(l => (l.owner_membership_id === membershipId ? canCreate : canManageTeam)
    && `${l.account_name} ${l.contact_name ?? ''} ${l.contact_details ?? ''} ${l.lead_code}`.toLowerCase().includes(search.trim().toLowerCase()));
  const matches = (context?.matching_leads ?? []).filter(l => l.owner_membership_id === membershipId ? canCreate : canManageTeam);
  const selectedSource = sources.find(s => s.id === leadForm.source_id);
  const conv = context?.conversation;
  const score = conv?.lead_score ?? 0;
  const attribution = conv?.attribution;

  return <section className={styles.crm} aria-label="Kontak CRM dan pipeline" aria-busy={loading || saving}>
    <div className={styles.sectionHeading}>
      <h2>Kontak CRM</h2>
      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
        {conv?.reference_code && <span className={styles.referenceCode}>{conv.reference_code}</span>}
        <button type="button" disabled={saving} aria-label="Perbarui detail CRM" onClick={() => { setError(''); void load(true); }}><FiRefreshCw /></button>
      </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {loading ? <p>Memuat kontak dan pipeline…</p> : !context ? <p>Perbarui detail untuk memuat data CRM.</p> : <>
      <span className={styles.captureBadge}>Tersimpan dari WhatsApp</span>

      {/* Lead Score & Attribution */}
      {(conv?.lead_score !== undefined || attribution) && <div className={styles.leadInsights}>
        {conv?.lead_score !== undefined && <div className={styles.scoreCard} style={{'--score-color': scoreColor(score)} as React.CSSProperties}>
          <FiAward size={20} /><span className={styles.scoreValue}>{score}</span><span className={styles.scoreLabel}>{scoreLabel(score)}</span>
          <details><summary>Detail skor</summary><pre>{JSON.stringify(conv.score_breakdown, null, 2)}</pre></details>
        </div>}
        {attribution && (attribution.utm_source || attribution.utm_medium || attribution.utm_campaign) && <div className={styles.attributionCard}>
          <FiZap size={20} /><strong>Attribution:</strong>
          <span>{attribution.utm_source && `utm_source: ${attribution.utm_source}`}</span>
          <span>{attribution.utm_medium && `utm_medium: ${attribution.utm_medium}`}</span>
          <span>{attribution.utm_campaign && `utm_campaign: ${attribution.utm_campaign}`}</span>
          <span>{attribution.referrer && `Referrer: ${attribution.referrer}`}</span>
        </div>}
      </div>}

      {editor === 'contact' ? <form className={styles.crmForm} onSubmit={saveContact}>
        <label>Nama kontak<input required maxLength={180} value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} /></label>
        <label>Perusahaan / instansi<input maxLength={180} value={contactForm.organization} onChange={e => setContactForm({ ...contactForm, organization: e.target.value })} /></label>
        <label>Email<input type="email" maxLength={254} value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} /></label>
        <label>Jabatan<input maxLength={120} value={contactForm.role} onChange={e => setContactForm({ ...contactForm, role: e.target.value })} /></label>
        <label>Kebutuhan / catatan<textarea rows={4} maxLength={5000} value={contactForm.notes} onChange={e => setContactForm({ ...contactForm, notes: e.target.value })} /></label>
        <p className={styles.help}>Nomor WhatsApp menjadi identitas kontak. Data yang dilengkapi tim tetap tersimpan saat pesan baru masuk.</p>
        <div className={styles.formActions}><button type="button" disabled={saving} onClick={() => setEditor(null)}>Batal</button><button data-primary disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan kontak'}</button></div>
      </form> : <>
        <dl>
          <dt>Nama kontak</dt><dd>{context.contact.name || 'Belum dilengkapi'}</dd>
          <dt>Perusahaan / instansi</dt><dd>{context.contact.organization || 'Belum dilengkapi'}</dd>
          <dt>Email</dt><dd>{context.contact.email || 'Belum dilengkapi'}</dd>
          <dt>Jabatan</dt><dd>{context.contact.role || 'Belum dilengkapi'}</dd>
          <dt>Kebutuhan / catatan</dt><dd className={styles.contactNotes}>{context.contact.notes || 'Belum ada catatan'}</dd>
        </dl>
        {canEditContact && <button className={styles.secondaryButton} disabled={saving} onClick={editContact}><FiEdit3 /> Lengkapi kontak</button>}
      </>}

      {/* Quick Replies */}
      {quickReplies.length > 0 && <div className={styles.quickReplies}>
        <div className={styles.sectionHeading}><h3>Quick Replies</h3><FiSend /></div>
        <div className={styles.quickReplyList}>
          {quickReplies.map(qr => <button key={qr.id} type="button" className={styles.quickReplyBtn} title={qr.description || qr.content} onClick={() => navigator.clipboard.writeText(qr.content)}>{qr.shortcut}</button>)}
        </div>
        <p className={styles.help}>Klik untuk menyalin ke clipboard, lalu paste di composer.</p>
      </div>}

      {/* Templates */}
      {templates.length > 0 && <div className={styles.templates}>
        <div className={styles.sectionHeading}><h3>Template WhatsApp (di luar 24 jam)</h3><FiInfo /></div>
        <div className={styles.templateList}>
          {templates.map(t => <button key={t.id} type="button" className={styles.templateBtn} onClick={() => {
            // Would open modal to send template
            alert(`Kirim template: ${t.name}\nKategori: ${t.category}\nBahasa: ${t.language}`);
          }}>{t.name} <span className={styles.templateCategory}>{t.category}</span></button>)}
        </div>
      </div>}

      <div className={styles.sectionHeading}><h2>Pipeline BD</h2><FiLink /></div>
      {linked ? <div className={styles.linkedLead}>
        <small>{linked.source_name} · {linked.lead_code}</small>
        <h3>{linked.account_name}</h3>
        <span className={styles.stageBadge} style={{background: linked.source_color}}>{linked.stage}</span>
        <dl>
          <dt>PIC / owner</dt><dd>{linked.owner_name}</dd>
          <dt>Next action</dt><dd>{linked.next_action}</dd>
          <dt>Tenggat</dt><dd>{dateLabel(linked.due_date)}</dd>
<dt>Kontak terakhir</dt>
            <dd>{linked.last_contact_date ? dateLabel(linked.last_contact_date) : 'Belum tercatat'}</dd>
            {linked.extra_data?.lead_score ? (() => {
              const ls = linked.extra_data.lead_score as number;
              return (
                <React.Fragment key="ls">
                  <dt>Lead Score</dt>
                  <dd>{ls} ({scoreLabel(ls)})</dd>
                </React.Fragment>
              );
            })() : null}
        </dl>
        <Link href={`/ruang-kawan/pipeline/?lead=${encodeURIComponent(linked.id)}`}>Buka lead di pipeline <FiExternalLink /></Link>
        {canEditLead && editor !== 'followup' && <button className={styles.secondaryButton} disabled={saving} onClick={() => { editingLeadId.current = linked.id; setFollowup({ stage: linked.stage, next_action: linked.next_action, due_date: linked.due_date }); setEditor('followup'); setError(''); setNotice(''); }}><FiEdit3 /> Atur tindak lanjut</button>}
        {editor === 'followup' && <form className={styles.crmForm} onSubmit={saveFollowup}>
          <label>Stage<select required value={followup.stage} onChange={e => setFollowup({ ...followup, stage: e.target.value })}>{Array.from(new Set([linked.stage, ...(linked.source_config?.stages ?? [])])).map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Next action<input required maxLength={500} value={followup.next_action} onChange={e => setFollowup({ ...followup, next_action: e.target.value })} /></label>
          <label>Tenggat<input type="date" required value={followup.due_date} onChange={e => setFollowup({ ...followup, due_date: e.target.value })} /></label>
          <div className={styles.formActions}><button type="button" disabled={saving} onClick={() => setEditor(null)}>Batal</button><button data-primary disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan tindak lanjut'}</button></div>
        </form>}
        {canEditLead && <button className={styles.unlinkButton} disabled={saving} onClick={() => {
          if (window.confirm('Lepas kaitan percakapan ini? Kontak, lead, dan riwayat pesan tetap tersimpan.')) void mutate(() => createClient().rpc('link_whatsapp_pipeline_lead', { target_conversation_id: conversationId, target_lead_id: null }), 'Kaitan dilepas. Kontak, lead, dan pesan tetap tersimpan.');
        }}><FiX /> Lepas kaitan</button>}
        {canTransfer && <button className={styles.transferButton} disabled={saving} onClick={() => { setTransferTargetId(''); setTransferNote(''); setEditor('transfer'); }}><FiUsers /> Alihkan percakapan</button>}
      </div> : context.has_linked_lead ? <p>Percakapan ini sudah terhubung ke lead dengan akses terbatas. Hubungi PIC atau administrator untuk mengelolanya.</p> : <>
        <p>Kontak belum terhubung ke pipeline. Pilih lead yang sudah ada atau buat lead beserta tindak lanjutnya.</p>
        
        {/* Smart Lead Creation */}
        {canCreate && <button className={styles.smartCreateBtn} disabled={saving || !sources.length} onClick={createLeadSmart}><FiZap /> Buat lead otomatis (AI-suggested)</button>}
        
        {(canCreate || canManageTeam) && editor !== 'create' && <form className={styles.crmForm} onSubmit={linkLead}>
          {matches.length > 0 && <div className={styles.matches}><strong>{matches.length} lead dengan nomor yang sama</strong><p>Periksa kecocokan sebelum mengaitkan.</p>{matches.map(l => <button type="button" key={l.id} disabled={saving} onClick={() => { setSearch(''); setSelectedLead(l.id); }} data-active={selectedLead === l.id}>{l.account_name} · {l.lead_code}</button>)}</div>}
          <label>Cari lead<input type="search" placeholder="Nama, nomor, atau kode lead" value={search} onChange={e => { setSearch(e.target.value); setSelectedLead(''); }} /></label>
          <label>Lead yang akan dikaitkan<select required value={selectedLead} onChange={e => setSelectedLead(e.target.value)}><option value="">Pilih lead</option>{candidates.map(l => <option key={l.id} value={l.id}>{l.account_name} · {l.lead_code} · {l.stage}</option>)}</select></label>
          {!candidates.length && <p className={styles.help}>Tidak ada lead yang cocok dan dapat Anda kelola.</p>}
          <button className={styles.primaryButton} disabled={saving || !selectedLead}><FiLink /> {saving ? 'Mengaitkan…' : 'Kaitkan ke lead'}</button>
        </form>}
        {canCreate && editor !== 'create' && <button className={styles.secondaryButton} disabled={saving || !sources.length} onClick={createLead}><FiPlus /> Buat lead manual</button>}
        {canCreate && !sources.length && <p className={styles.help}>Akses sumber pipeline diperlukan untuk membuat lead.</p>}
        
        {editor === 'create' && <form className={styles.crmForm} onSubmit={saveLead}>
          {showSmartCreate && smartLeadData && <div className={styles.smartCreateNotice}>
            <FiZap /> Data diisi otomatis dari percakapan. Tinjau dan sesuaikan sebelum simpan.
          </div>}
          <label>Pipeline<select required value={leadForm.source_id} onChange={e => { const source = sources.find(s => s.id === e.target.value); setLeadForm({ ...leadForm, source_id: e.target.value, ...defaults(source) }); }}>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Perusahaan / nama lead<input required maxLength={180} value={leadForm.account_name} onChange={e => setLeadForm({ ...leadForm, account_name: e.target.value })} /></label>
          {canAssignTeam ? <label>PIC / owner<select required value={leadForm.owner_membership_id} onChange={e => setLeadForm({ ...leadForm, owner_membership_id: e.target.value })}>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label> : <p className={styles.help}>PIC: Anda. Lead dan aktivitas tindak lanjut akan ditugaskan kepada Anda.</p>}
          <label>Stage<select required value={leadForm.stage} onChange={e => setLeadForm({ ...leadForm, stage: e.target.value })}>{selectedSource?.module_config.stages?.map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Prioritas<select required value={leadForm.priority} onChange={e => setLeadForm({ ...leadForm, priority: e.target.value })}>{(selectedSource?.module_config.priorities?.length ? selectedSource.module_config.priorities : ['Medium']).map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Unit bisnis<select value={leadForm.business_unit} onChange={e => setLeadForm({ ...leadForm, business_unit: e.target.value })}><option value="">Belum dipilih</option>{selectedSource?.module_config.business_units?.map(b => <option key={b}>{b}</option>)}</select></label>
          <label>Jenis aktivitas<select required value={leadForm.activity_type} onChange={e => setLeadForm({ ...leadForm, activity_type: e.target.value })}>{(selectedSource?.module_config.activity_types?.length ? selectedSource.module_config.activity_types : ['Follow Up']).map(a => <option key={a}>{a}</option>)}</select></label>
          <label>Next action<input required maxLength={500} value={leadForm.next_action} onChange={e => setLeadForm({ ...leadForm, next_action: e.target.value })} /></label>
          <label>Tenggat<input type="date" required value={leadForm.due_date} onChange={e => setLeadForm({ ...leadForm, due_date: e.target.value })} /></label>
          <p className={styles.help}>Nama, nomor WhatsApp, dan catatan CRM ikut masuk ke lead. Next action tersambung ke My Activity.</p>
          <div className={styles.formActions}><button type="button" disabled={saving} onClick={() => { setEditor(null); setShowSmartCreate(false); setSmartLeadData(null); }}>Batal</button><button data-primary disabled={saving}>{saving ? 'Menyimpan…' : (showSmartCreate ? 'Buat & kaitkan lead (smart)' : 'Buat & kaitkan lead')}</button></div>
        </form>}
      </>}

      {/* Tags Editor */}
      {editor === 'tags' && <form className={styles.crmForm} onSubmit={saveTags}>
        <label>Tag (pisahkan dengan koma)<input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="contoh: inquiry, hot-lead, follow-up" /></label>
        <p className={styles.help}>Tag ada: {conv?.tags?.join(', ') || '—'}</p>
        <div className={styles.formActions}><button type="button" disabled={saving} onClick={() => setEditor(null)}>Batal</button><button data-primary disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan tag'}</button></div>
      </form>}

      {/* Transfer Conversation */}
      {editor === 'transfer' && canTransfer && <form className={styles.crmForm} onSubmit={saveTransfer}>
        <label>Alihkan ke<select required value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)}><option value="">Pilih anggota tim</option>{members.filter(m => m.id !== membershipId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Catatan alihkan<textarea rows={3} value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="Alasan alihkan, konteks tambahan..." /></label>
        <div className={styles.formActions}><button type="button" disabled={saving} onClick={() => setEditor(null)}>Batal</button><button data-primary disabled={saving}>{saving ? 'Menyimpan…' : 'Alihkan percakapan'}</button></div>
      </form>}

    </>}
  </section>;
}