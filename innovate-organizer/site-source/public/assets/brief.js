(function () {
  'use strict';
  const form = document.getElementById('brief-form');
  const button = document.getElementById('brief-submit');
  const status = document.getElementById('brief-status');
  const continueLink = document.getElementById('brief-continue');
  const t = text => typeof translateSiteText === 'function' ? translateSiteText(text) : text;
  let submissionId = null, fingerprint = '', pending = false;
  const attribution = {};
  const query = new URLSearchParams(location.search);
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid']) {
    const value = query.get(key);
    if (value) attribution[key] = value.slice(0, 200);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    pending = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
    status.textContent = t('Menyimpan brief…'); continueLink.hidden = true;
    const values = Object.fromEntries(new FormData(form));
    const signature = JSON.stringify(values);
    if (signature !== fingerprint) { submissionId = crypto.randomUUID(); fingerprint = signature; }
    // Open synchronously to avoid popup blockers after the server request.
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const response = await fetch('/api/brief', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, id: submissionId, consent: values.consent === 'on', attribution }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('save_failed');
      const saved = await response.json();
      if (!saved.ok || saved.id !== submissionId) throw new Error('save_failed');
      window.IOTracking?.briefSaved(saved.id);
      const fields = [['Nama/perusahaan','nama'],['Nomor WhatsApp','kontak'],['Jenis acara','jenis'],['Tanggal','tanggal'],['Peserta','jumlah'],['Lokasi & kebutuhan','kebutuhan']];
      const message = [t('Halo Innovate Organizer, saya ingin konsultasi acara.'), ...fields.map(([label,key]) => t(label) + ': ' + (String(values[key] || '').trim() || '-')), 'Ref: ' + saved.id].join('\n');
      const url = 'https://wa.me/6285882514394?text=' + encodeURIComponent(message);
      continueLink.href = url; continueLink.hidden = false;
      status.textContent = t('Brief tersimpan. Lanjutkan di WhatsApp dan tekan Kirim untuk memulai percakapan.');
      if (popup && !popup.closed) popup.location.replace(url);
    } catch {
      if (popup && !popup.closed) popup.close();
      status.textContent = t('Brief belum tersimpan. Coba lagi, atau hubungi kami lewat tombol WhatsApp.');
    } finally { pending = false; button.disabled = false; form.removeAttribute('aria-busy'); }
  });
}());
